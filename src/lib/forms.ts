/**
 * The limits of the website's forms, shared by the browser (validation in
 * place) and the Site API (which always checks again): one source, so the two
 * can never disagree. Browser-safe: no server code here.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LIMITS = {
  email: 254,
  firstName: 60,
  contactName: 80,
  contactBodyMin: 10,
  contactBody: 4000,
} as const;
