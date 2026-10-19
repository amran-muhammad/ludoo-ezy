import {type FormEvent, useId, useRef, useState} from 'react';

import {EMAIL_RE} from '../../lib/forms';

/**
 * The website's form state (the portal's `useForm`, with ids unique per form
 * so two sign-up boxes can share a page):
 *
 * - an error shows when the field is left or the form is submitted, never
 *   while the first value is being typed; once shown it follows every keystroke;
 * - `submit(onValid)` checks every field, focuses the first wrong one and
 *   sends nothing until all pass;
 * - `setServerErrors` puts the Site API's answer under the field it names.
 */

export type Rule = (value: string) => string | null;

export const rules = {
  required:
    (message: string): Rule =>
    value =>
      value.trim() ? null : message,
  maxLength:
    (max: number, message = `Use at most ${max} characters.`): Rule =>
    value =>
      value.trim().length <= max ? null : message,
  minLength:
    (min: number, message = `Write at least ${min} characters.`): Rule =>
    value =>
      !value.trim() || value.trim().length >= min ? null : message,
  email:
    (message = 'Enter a valid email address, like name@example.com.'): Rule =>
    value =>
      !value.trim() || EMAIL_RE.test(value.trim()) ? null : message,
};

type Values = Record<string, string>;

export function useSiteForm<V extends Values>(initial: V, schema: Partial<Record<keyof V, Rule[]>>) {
  const prefix = useId();
  const [values, setValues] = useState<V>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof V, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [server, setServer] = useState<Partial<Record<keyof V, string>>>({});
  const refs = useRef<Partial<Record<keyof V, HTMLElement | null>>>({});

  const check = (name: keyof V): string | undefined => {
    for (const rule of schema[name] ?? []) {
      const message = rule(values[name] ?? '');
      if (message) return message;
    }
    return undefined;
  };
  const error = (name: keyof V) => (touched[name] || submitted ? (server[name] ?? check(name)) : server[name]);

  const set = (name: keyof V, value: string) => {
    setValues(current => ({...current, [name]: value}));
    setServer(current => ({...current, [name]: undefined}));
  };

  const ids = (name: keyof V & string) => ({
    id: `${prefix}-${name}`,
    hint: `${prefix}-${name}-hint`,
    error: `${prefix}-${name}-error`,
  });

  /** Everything an `<Input>` or `<Textarea>` needs. */
  const field = (name: keyof V & string) => {
    const message = error(name);
    const id = ids(name);
    return {
      id: id.id,
      name,
      value: values[name] ?? '',
      ref: (node: HTMLElement | null) => {
        refs.current[name] = node;
      },
      onChange: (event: {target: {value: string}}) => set(name, event.target.value),
      onBlur: () => setTouched(current => ({...current, [name]: true})),
      'aria-invalid': message ? true : undefined,
      'aria-describedby': message ? id.error : id.hint,
    };
  };

  const submit = (onValid: (values: V) => void) => (event?: FormEvent) => {
    event?.preventDefault();
    setSubmitted(true);
    const first = (Object.keys(schema) as (keyof V)[]).find(name => check(name));
    if (first) {
      refs.current[first]?.focus();
      return;
    }
    onValid(values);
  };

  const reset = () => {
    setValues(initial);
    setTouched({});
    setSubmitted(false);
    setServer({});
  };

  return {
    values,
    set,
    field,
    ids,
    error,
    submit,
    reset,
    registerRef: (name: keyof V) => (node: HTMLElement | null) => {
      refs.current[name] = node;
    },
    setServerErrors: (errors: Partial<Record<keyof V, string>>) => {
      setServer(errors);
      const first = Object.keys(errors)[0] as keyof V | undefined;
      if (first) refs.current[first]?.focus();
    },
  };
}

/** POST JSON to a Site API route; the `{error, message, field?}` body on failure. */
export async function postJson(path: string, body: unknown): Promise<{ok: true} | {ok: false; message: string; field?: string}> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: {'content-type': 'application/json', accept: 'application/json'},
      body: JSON.stringify(body),
    });
    if (res.ok) return {ok: true};
    const data = (await res.json().catch(() => null)) as {message?: string; field?: string} | null;
    if (res.status === 503) {
      return {ok: false, message: 'Sign-ups are paused for a moment. Please try again later.'};
    }
    return {ok: false, message: data?.message ?? 'Something went wrong. Please try again.', field: data?.field};
  } catch {
    return {ok: false, message: 'You seem to be offline. Check your connection and try again.'};
  }
}
