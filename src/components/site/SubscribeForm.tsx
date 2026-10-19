import {CircleCheckIcon} from 'lucide-react';
import {useState} from 'react';

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {Button} from '@/components/ui/button';
import {Field, FieldDescription, FieldError, FieldGroup, FieldLabel} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {Spinner} from '@/components/ui/spinner';
import {cn} from '@/lib/utils';
import {LIMITS} from '../../lib/forms';
import {postJson, rules, useSiteForm} from './use-site-form';

/**
 * The newsletter sign-up box: `POST /site-api/newsletter/subscribe`, stored in
 * the Site Database. Rendered as an island (`client:load`) on the home page,
 * the Subscribe page, the Contact page and under every post.
 */

interface Props {
  /** Which box this is, kept with the sign-up (`home`, `subscribe`, `post`…). */
  source: string;
  /** Ask for a first name too. */
  withName?: boolean;
  /** `inline`: email and button side by side from small screens up. */
  layout?: 'inline' | 'stacked';
  buttonLabel?: string;
  note?: string;
  className?: string;
}

const SCHEMA = {
  firstName: [rules.maxLength(LIMITS.firstName)],
  email: [
    rules.required('Enter your email address.'),
    rules.email(),
    rules.maxLength(LIMITS.email, 'That address is too long to be real. Check it and try again.'),
  ],
};

export default function SubscribeForm({
  source,
  withName = false,
  layout = 'stacked',
  buttonLabel = 'Subscribe free',
  note,
  className,
}: Props) {
  const form = useSiteForm({firstName: '', email: '', website: ''}, SCHEMA);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const onSubmit = form.submit(async values => {
    setPending(true);
    setFailure(null);
    const result = await postJson('/site-api/newsletter/subscribe', {
      email: values.email.trim(),
      firstName: values.firstName.trim() || undefined,
      website: values.website,
      tier: 'free',
      source,
    });
    setPending(false);
    if (result.ok) {
      setDone(values.email.trim());
      form.reset();
      return;
    }
    if (result.field === 'email' || result.field === 'firstName') {
      form.setServerErrors({[result.field]: result.message});
    } else {
      setFailure(result.message);
    }
  });

  if (done) {
    return (
      <Alert className={className} role="status">
        <CircleCheckIcon />
        <AlertTitle>You’re on the list</AlertTitle>
        <AlertDescription>
          The next issue goes to <strong className="break-all">{done}</strong> on Sunday morning.
          <button type="button" className="mt-2 block underline underline-offset-4" onClick={() => setDone(null)}>
            Sign up another address
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  const email = form.ids('email');
  const firstName = form.ids('firstName');
  const emailError = form.error('email');
  const nameError = form.error('firstName');
  const inline = layout === 'inline';

  return (
    <form noValidate onSubmit={onSubmit} className={cn('w-full', className)} aria-label="Subscribe to the newsletter">
      <FieldGroup className="gap-6">
        {withName && (
          <Field data-invalid={nameError ? true : undefined}>
            <FieldLabel htmlFor={firstName.id}>
              First name <span className="font-normal normal-case tracking-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input {...form.field('firstName')} autoComplete="given-name" placeholder="Alex" disabled={pending} />
            {nameError ? (
              <FieldError id={firstName.error}>{nameError}</FieldError>
            ) : (
              <FieldDescription id={firstName.hint}>So the email can say hello properly.</FieldDescription>
            )}
          </Field>
        )}

        <div className={cn('flex flex-col gap-4', inline && 'sm:flex-row sm:items-start')}>
          <Field data-invalid={emailError ? true : undefined} className="flex-1">
            <FieldLabel htmlFor={email.id}>Email address</FieldLabel>
            <Input
              {...form.field('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              disabled={pending}
            />
            {emailError ? (
              <FieldError id={email.error}>{emailError}</FieldError>
            ) : (
              <FieldDescription id={email.hint}>{note ?? 'One email a week. Unsubscribe in one click.'}</FieldDescription>
            )}
          </Field>
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            aria-busy={pending || undefined}
            className={cn('w-full', inline && 'sm:mt-7 sm:w-auto')}>
            {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
            {pending ? 'Subscribing…' : buttonLabel}
          </Button>
        </div>

        {/* A field people never see: bots fill it in, and the server drops those sign-ups. */}
        <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
          <label htmlFor={`${email.id}-website`}>Leave this empty</label>
          <input
            id={`${email.id}-website`}
            tabIndex={-1}
            autoComplete="off"
            value={form.values.website}
            onChange={event => form.set('website', event.target.value)}
          />
        </div>

        {failure && (
          <FieldError className="-mt-2" role="alert">
            {failure}
          </FieldError>
        )}
      </FieldGroup>
    </form>
  );
}
