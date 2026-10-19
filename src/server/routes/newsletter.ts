import {Hono} from 'hono';
import {validator} from 'hono/validator';

import {EMAIL_RE, LIMITS} from '../../lib/forms';
import {TIERS, type SubscriberRow, type SubscribersPage} from '../../lib/types';
import {problem, requireMember, requirePermission, withDb, withViewer} from '../../platform/guards';
import {CODENAMES} from '../../platform/permissions';

/**
 * The newsletter's reader list, stored in the Site Database (table `subscribers`).
 *
 * Public (the sign-up boxes on the website):
 *   POST /site-api/newsletter/subscribe   {email, firstName?, tier?, source?}
 *
 * Site admins (`MANAGE_NEWSLETTER`), from the dashboard (`/portal/subscribers`):
 *   GET  /site-api/newsletter/subscribers?before=   newest first, 25 a page
 *   GET  /site-api/newsletter/subscribers.csv       every active reader, as CSV
 *
 * A second sign-up with the same address answers the same "you're on the
 * list", so the form never tells a stranger whether an address is subscribed.
 */

/** Who may read the reader list: the community's site admins. */
export const MANAGE_NEWSLETTER = CODENAMES.SITE_UPDATE;

const PAGE_SIZE = 25;
/** The CSV export reads in batches of this many rows, up to `EXPORT_MAX`. */
const EXPORT_BATCH = 1000;
const EXPORT_MAX = 20000;

const rowSelect = {
  id: true,
  email: true,
  firstName: true,
  tier: true,
  source: true,
  status: true,
  createdAt: true,
} as const;

const cursorOf = (value: unknown) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

const subscribeBody = validator('json', (value, c) => {
  const v = (value ?? {}) as Record<string, unknown>;
  // A field people never see: a bot that fills it is answered "ok" and dropped.
  const trap = typeof v.website === 'string' && v.website.trim() !== '';
  const email = typeof v.email === 'string' ? v.email.trim().toLowerCase() : '';
  if (!email) return c.json({...problem('invalid_email', 'Enter your email address.'), field: 'email'}, 422);
  if (email.length > LIMITS.email || !EMAIL_RE.test(email)) {
    return c.json(
      {...problem('invalid_email', 'Enter a valid email address, like name@example.com.'), field: 'email'},
      422
    );
  }
  const firstName = typeof v.firstName === 'string' ? v.firstName.trim() : '';
  if (firstName.length > LIMITS.firstName) {
    return c.json({...problem('invalid_name', `Use at most ${LIMITS.firstName} characters.`), field: 'firstName'}, 422);
  }
  const tier = typeof v.tier === 'string' && (TIERS as string[]).includes(v.tier) ? v.tier : 'free';
  const source = typeof v.source === 'string' && /^[a-z-]{1,30}$/.test(v.source) ? v.source : 'home';
  return {email, firstName: firstName || null, tier, source, trap};
});

const listQuery = validator('query', value => ({
  before: typeof value.before === 'string' ? value.before : undefined,
}));

const csvCell = (value: string | null) => {
  const text = value ?? '';
  // Quote everything; neutralise spreadsheet formulas (=, +, -, @ at the start).
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const newsletterRoutes = new Hono()
  .post('/subscribe', subscribeBody, withDb, async c => {
    const {trap, ...input} = c.req.valid('json');
    if (!trap) {
      await c.var.db.subscriber.upsert({
        where: {email: input.email},
        create: input,
        // Signing up again re-activates the address and keeps the latest choice.
        update: {status: 'active', tier: input.tier, ...(input.firstName ? {firstName: input.firstName} : {})},
        select: {id: true},
      });
    }
    return c.json({ok: true as const}, 201);
  })

  .get(
    '/subscribers',
    listQuery,
    withViewer,
    requireMember,
    requirePermission(MANAGE_NEWSLETTER),
    withDb,
    async c => {
      const cursor = cursorOf(c.req.valid('query').before);
      const rows = await c.var.db.subscriber.findMany({
        select: rowSelect,
        where: cursor ? {id: {lt: cursor}} : undefined,
        orderBy: {id: 'desc'},
        take: PAGE_SIZE + 1,
      });
      const subscribers = rows.slice(0, PAGE_SIZE);
      c.header('Cache-Control', 'private, no-store');
      const page: SubscribersPage = {
        subscribers: subscribers.map(
          (row): SubscriberRow => ({...row, createdAt: row.createdAt.toISOString()})
        ),
        nextBefore: rows.length > PAGE_SIZE ? subscribers.at(-1)!.id : null,
      };
      return c.json(page);
    }
  )

  .get('/subscribers.csv', withViewer, requireMember, requirePermission(MANAGE_NEWSLETTER), withDb, c => {
    const db = c.var.db;
    const encoder = new TextEncoder();
    // Streamed in keyset batches: never the whole table in memory at once.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode('email,first_name,tier,source,signed_up\n'));
        let after = 0;
        let sent = 0;
        try {
          while (sent < EXPORT_MAX) {
            const batch = await db.subscriber.findMany({
              select: {id: true, email: true, firstName: true, tier: true, source: true, createdAt: true},
              where: {status: 'active', id: {gt: after}},
              orderBy: {id: 'asc'},
              take: EXPORT_BATCH,
            });
            if (!batch.length) break;
            const lines = batch.map(row =>
              [row.email, row.firstName, row.tier, row.source, row.createdAt.toISOString()].map(csvCell).join(',')
            );
            controller.enqueue(encoder.encode(`${lines.join('\n')}\n`));
            sent += batch.length;
            after = batch.at(-1)!.id;
            if (batch.length < EXPORT_BATCH) break;
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="subscribers.csv"',
        'Cache-Control': 'private, no-store',
      },
    });
  });
