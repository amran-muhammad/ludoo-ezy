import {CircleCheckIcon} from 'lucide-react';
import {useState} from 'react';

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {Button} from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group';
import {Spinner} from '@/components/ui/spinner';
import {Textarea} from '@/components/ui/textarea';
import {LIMITS} from '../../lib/forms';
import {CONTACT_TOPICS} from '../../lib/types';
import {postJson, rules, useSiteForm} from './use-site-form';

/**
 * The contact form: `POST /site-api/contact`, stored in the Site Database and
 * read by the owner in the dashboard (`/portal/messages`). The SAME limits as
 * `src/server/routes/contact.ts`.
 */

const SCHEMA = {
  name: [rules.required('Enter your name.'), rules.maxLength(LIMITS.contactName)],
  email: [
    rules.required('Enter your email address so I can reply.'),
    rules.email(),
    rules.maxLength(LIMITS.email, 'That address is too long to be real. Check it and try again.'),
  ],
  body: [
    rules.required('Write your message.'),
    rules.minLength(LIMITS.contactBodyMin, `Write at least ${LIMITS.contactBodyMin} characters so I know how to help.`),
    rules.maxLength(LIMITS.contactBody),
  ],
};

const INITIAL = {name: '', email: '', topic: 'general', body: '', website: ''};

export default function ContactForm() {
  const form = useSiteForm(INITIAL, SCHEMA);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const onSubmit = form.submit(async values => {
    setPending(true);
    setFailure(null);
    const result = await postJson('/site-api/contact', {
      name: values.name.trim(),
      email: values.email.trim(),
      topic: values.topic,
      body: values.body.trim(),
      website: values.website,
    });
    setPending(false);
    if (result.ok) {
      setSentTo(values.email.trim());
      form.reset();
      return;
    }
    if (result.field && result.field in INITIAL) {
      form.setServerErrors({[result.field]: result.message});
    } else {
      setFailure(result.message);
    }
  });

  if (sentTo) {
    return (
      <Alert role="status">
        <CircleCheckIcon />
        <AlertTitle>Thanks — your message is in</AlertTitle>
        <AlertDescription>
          I’ll reply to <strong className="break-all">{sentTo}</strong> within three working days.
          <button type="button" className="mt-2 block underline underline-offset-4" onClick={() => setSentTo(null)}>
            Send another message
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  const ids = {name: form.ids('name'), email: form.ids('email'), body: form.ids('body')};
  const errors = {name: form.error('name'), email: form.error('email'), body: form.error('body')};
  const bodyLength = form.values.body.trim().length;

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Contact form" className="relative">
      <FieldGroup className="gap-8">
        <div className="grid gap-8 sm:grid-cols-2">
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor={ids.name.id}>Your name</FieldLabel>
            <Input {...form.field('name')} autoComplete="name" placeholder="Alex Morgan" disabled={pending} />
            {errors.name && <FieldError id={ids.name.error}>{errors.name}</FieldError>}
          </Field>
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor={ids.email.id}>Email address</FieldLabel>
            <Input
              {...form.field('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              disabled={pending}
            />
            {errors.email ? (
              <FieldError id={ids.email.error}>{errors.email}</FieldError>
            ) : (
              <FieldDescription id={ids.email.hint}>Only used to reply to you.</FieldDescription>
            )}
          </Field>
        </div>

        <FieldSet>
          <FieldLegend>What is it about?</FieldLegend>
          <RadioGroup
            value={form.values.topic}
            onValueChange={value => form.set('topic', value)}
            disabled={pending}
            className="grid gap-3 sm:grid-cols-2">
            {CONTACT_TOPICS.map(topic => (
              <Field orientation="horizontal" key={topic.value}>
                <RadioGroupItem value={topic.value} id={`${ids.name.id}-topic-${topic.value}`} />
                <FieldLabel htmlFor={`${ids.name.id}-topic-${topic.value}`} className="font-normal normal-case tracking-normal text-sm">
                  {topic.label}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>

        <Field data-invalid={errors.body ? true : undefined}>
          <FieldLabel htmlFor={ids.body.id}>Message</FieldLabel>
          <Textarea
            {...form.field('body')}
            rows={6}
            className="min-h-36"
            placeholder="Tell me what’s on your mind."
            disabled={pending}
          />
          {errors.body ? (
            <FieldError id={ids.body.error}>{errors.body}</FieldError>
          ) : (
            <FieldDescription id={ids.body.hint}>
              {bodyLength > 0 ? `${bodyLength} / ${LIMITS.contactBody} characters` : `Up to ${LIMITS.contactBody} characters.`}
            </FieldDescription>
          )}
        </Field>

        <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
          <label htmlFor={`${ids.name.id}-website`}>Leave this empty</label>
          <input
            id={`${ids.name.id}-website`}
            tabIndex={-1}
            autoComplete="off"
            value={form.values.website}
            onChange={event => form.set('website', event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined} className="w-full sm:w-fit">
            {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
            {pending ? 'Sending…' : 'Send message'}
          </Button>
          {failure && <FieldError role="alert">{failure}</FieldError>}
        </div>
      </FieldGroup>
    </form>
  );
}
