/**
 * signup.js — the "Join OHDSI Boston" form.
 *
 * The site is static. The form POSTs FormData (name, email, institution,
 * hasData, website) to a Google Apps Script web app, which writes to a Sheet.
 * No credentials live here; the endpoint URL is public.
 *
 * The request uses mode: 'no-cors', so the response is opaque: the browser
 * cannot read whether the script accepted the row. "Submitted" therefore means
 * the request left the browser without a network error, and the copy says only
 * that. A thrown fetch (offline, DNS, blocked) is the one failure we can see.
 *
 * States, exposed as form[data-state] for CSS:
 *   idle → submitting → submitted | error;  invalid for native validation.
 */

import { CONFIG } from './config.js';

const MESSAGES = {
  invalid:    'Please enter your name and a valid email address.',
  submitting: 'Joining…',
  submitted:  "Thanks for joining OHDSI Boston. We'll keep you updated.",
  error:      "We couldn't submit that. Please try again."
};

/**
 * Attach signup behaviour to a form containing a submit button and a
 * [data-signup-status] element with aria-live="polite".
 * @param {HTMLFormElement} form
 */
export function attachSignup(form) {
  if (!form) return null;

  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-signup-status]');
  const buttonLabel = button.textContent;
  let state = 'idle';

  const setState = (next, message = '') => {
    state = next;
    form.dataset.state = next;
    button.disabled = next === 'submitting';
    button.textContent = next === 'submitting' ? MESSAGES.submitting : buttonLabel;
    if (status) status.textContent = message;
  };

  const markInvalid = () => {
    form.querySelectorAll('input[required]').forEach((input) => {
      input.setAttribute('aria-invalid', String(!input.validity.valid));
    });
  };

  setState('idle');

  form.addEventListener('input', (event) => {
    if (event.target.hasAttribute('aria-invalid')) {
      event.target.setAttribute('aria-invalid', String(!event.target.validity.valid));
    }
    if (state === 'invalid' || state === 'error' || state === 'submitted') setState('idle');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state === 'submitting') return;

    /* Native validation: required name, type=email. Trim first so a name of
       only spaces does not pass. */
    const name = form.elements.name;
    name.value = name.value.trim();
    markInvalid();
    if (!form.checkValidity()) {
      setState('invalid', MESSAGES.invalid);
      form.reportValidity();
      return;
    }

    setState('submitting', MESSAGES.submitting);

    /* An unchecked radio group is absent from FormData; send it empty so the
       script always receives the same five parameters. */
    const body = new FormData(form);
    if (!body.has('hasData')) body.set('hasData', '');

    try {
      await fetch(CONFIG.signup.endpoint, {
        method: 'POST',
        body,
        mode: 'no-cors'
      });
      form.reset();
      form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
      setState('submitted', MESSAGES.submitted);
    } catch {
      setState('error', MESSAGES.error);   // values are kept
    }
  });

  return { get state() { return state; } };
}
