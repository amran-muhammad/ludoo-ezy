import {Hono} from 'hono';
import {validator} from 'hono/validator';

import {EMAIL_RE, LIMITS} from '../../lib/forms';
import {CONTACT_TOPICS, type ContactMessageRow, type ContactMessagesPage} from '../../lib/types';
import {problem, requireMember, requirePermission, withDb, withViewer} from '../../platform/guards';
import {MANAGE_NEWSLETTER} from './newsletter';

/**
 * The contact form, stored in the Site Database (table `contact_messages`).
 * A Site cannot send email (every host but its own is blocked), so messages
 * wait in the dashboard for the owner to read and answer.
 *
 * Public:
 *   POST  /site-api/contact            {name, email, topic, body}
 *
 * Site admins (`MANAGE_NEWSLETTER`), from `/portal/messages`:
 *   GET   /site-api/contact?before=    newest first, 20 a page
 *   PATCH /site-api/contact/:id        {status: 'new' | 'read'}
 */

const PAGE_SIZE = 20;
const TOPIC_VALUES = CONTACT_TOPICS.map(topic => topic.value as string);

const rowSelect = {
  id: true,
  name: true,
  email: true,
  topic: true,
  body: true,
  status: true,
  createdAt: true,
} as const;

const cursorOf = (value: unknown) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

const fieldProblem = (field: string, message: string) => ({...problem('invalid_message', message), field});

const messageBody = validator('json', (value, c) => {
  const v = (value ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof v[key] === 'string' ? (v[key] as string).trim() : '');
  const trap = text('website') !== '';
  const name = text('name');
  const email = text('email').toLowerCase();
  const body = text('body');
  const topic = text('topic') || 'general';
  if (!name) return c.json(fieldProblem('name', 'Enter your name.'), 422);
  if (name.length > LIMITS.contactName) {
    return c.json(fieldProblem('name', `Use at most ${LIMITS.contactName} characters.`), 422);
  }
  if (!email) return c.json(fieldProblem('email', 'Enter your email address so I can reply.'), 422);
  if (email.length > LIMITS.email || !EMAIL_RE.test(email)) {
    return c.json(fieldProblem('email', 'Enter a valid email address, like name@example.com.'), 422);
  }
  if (!TOPIC_VALUES.includes(topic)) return c.json(fieldProblem('topic', 'Choose what your message is about.'), 422);
  if (body.length < LIMITS.contactBodyMin) {
    return c.json(fieldProblem('body', `Write at least ${LIMITS.contactBodyMin} characters.`), 422);
  }
  if (body.length > LIMITS.contactBody) {
    return c.json(fieldProblem('body', `Use at most ${LIMITS.contactBody} characters.`), 422);
  }
  return {name, email, topic, body, trap};
});

const listQuery = validator('query', value => ({
  before: typeof value.before === 'string' ? value.before : undefined,
}));

const statusBody = validator('json', (value, c) => {
  const status = (value as {status?: unknown} | null)?.status;
  if (status !== 'new' && status !== 'read') {
    return c.json(problem('invalid_status', 'Status is new or read.'), 422);
  }
  return {status};
});

const toRow = (row: {createdAt: Date} & Omit<ContactMessageRow, 'createdAt'>): ContactMessageRow => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

export const contactRoutes = new Hono()
  .post('/', messageBody, withDb, async c => {
    const {trap, ...input} = c.req.valid('json');
    if (!trap) await c.var.db.contactMessage.create({data: input, select: {id: true}});
    return c.json({ok: true as const}, 201);
  })

  .get('/', listQuery, withViewer, requireMember, requirePermission(MANAGE_NEWSLETTER), withDb, async c => {
    const cursor = cursorOf(c.req.valid('query').before);
    const rows = await c.var.db.contactMessage.findMany({
      select: rowSelect,
      where: cursor ? {id: {lt: cursor}} : undefined,
      orderBy: {id: 'desc'},
      take: PAGE_SIZE + 1,
    });
    const messages = rows.slice(0, PAGE_SIZE);
    c.header('Cache-Control', 'private, no-store');
    const page: ContactMessagesPage = {
      messages: messages.map(toRow),
      nextBefore: rows.length > PAGE_SIZE ? messages.at(-1)!.id : null,
    };
    return c.json(page);
  })

  .patch('/:id', statusBody, withViewer, requireMember, requirePermission(MANAGE_NEWSLETTER), withDb, async c => {
    const id = cursorOf(c.req.param('id'));
    const found = id ? await c.var.db.contactMessage.findUnique({where: {id}, select: {id: true}}) : null;
    if (!found) return c.json(problem('not_found', 'No such message.'), 404);
    const row = await c.var.db.contactMessage.update({
      where: {id: found.id},
      data: {status: c.req.valid('json').status},
      select: rowSelect,
    });
    return c.json({message: toRow(row)});
  });
