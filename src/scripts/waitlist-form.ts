// Waitlist form — client behaviour.
// Handles: timestamp stamp, honeypot, client-side validation, submit to
// /api/waitlist, and the success / validation / server / network states.
// The backend endpoint is added in Gate 2; until then a submit that passes
// client validation will surface the server/network error state (expected).

interface ClientMessages {
  errorValidation: string;
  errorConsent: string;
  errorServer: string;
  errorNetwork: string;
  submit: string;
  submitting: string;
}

const form = document.getElementById('waitlist-form') as HTMLFormElement | null;

if (form) {
  const messagesEl = document.getElementById('waitlist-messages');
  const messages: ClientMessages = messagesEl?.textContent
    ? (JSON.parse(messagesEl.textContent) as ClientMessages)
    : {
        errorValidation: 'Please check the highlighted fields and try again.',
        errorConsent: 'Please confirm your consent to continue.',
        errorServer: 'Something went wrong. Please try again.',
        errorNetwork: 'Network error. Please try again.',
        submit: 'Submit',
        submitting: 'Sending…',
      };

  const submitBtn = document.getElementById('waitlist-submit') as HTMLButtonElement | null;
  const errorSummary = document.getElementById('waitlist-error');
  const successPanel = document.getElementById('waitlist-success');
  const tsField = form.elements.namedItem('ts') as HTMLInputElement | null;
  const honeypot = form.elements.namedItem('company') as HTMLInputElement | null;

  // Stamp render time — used by the server as a minimum fill-time trap.
  if (tsField) tsField.value = String(Date.now());

  const REQUIRED = [
    'name',
    'email',
    'preferredChannel',
    'contactValue',
    'country',
    'interestClass',
    'gdprConsent',
  ] as const;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function fieldError(name: string): HTMLElement | null {
    return form!.querySelector(`[data-error-for="${name}"]`);
  }

  function getControls(name: string): HTMLInputElement[] {
    return Array.from(form!.querySelectorAll(`[name="${name}"]`)) as HTMLInputElement[];
  }

  function rawValue(name: string): string {
    const controls = getControls(name);
    if (controls.length === 0) return '';
    const first = controls[0];
    if (first.type === 'radio') {
      const checked = controls.find((c) => c.checked);
      return checked ? checked.value : '';
    }
    if (first.type === 'checkbox') {
      return first.checked ? first.value || 'true' : '';
    }
    return first.value.trim();
  }

  function setFieldInvalid(name: string, invalid: boolean): void {
    const err = fieldError(name);
    if (err) err.classList.toggle('hidden', !invalid);
    for (const control of getControls(name)) {
      if (invalid) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    }
  }

  function clearErrors(): void {
    for (const name of REQUIRED) setFieldInvalid(name, false);
    if (errorSummary) {
      errorSummary.classList.add('hidden');
      errorSummary.textContent = '';
    }
  }

  function showSummary(text: string): void {
    if (!errorSummary) return;
    errorSummary.textContent = text;
    errorSummary.classList.remove('hidden');
  }

  // Returns the list of invalid required field names (empty = valid).
  function validate(): string[] {
    const invalid: string[] = [];
    for (const name of REQUIRED) {
      const value = rawValue(name);
      let ok = value !== '';
      if (ok && name === 'email') ok = EMAIL_RE.test(value);
      if (!ok) invalid.push(name);
      setFieldInvalid(name, !ok);
    }
    return invalid;
  }

  function focusField(name: string): void {
    const control = getControls(name)[0];
    if (control && typeof control.focus === 'function') control.focus();
  }

  function setBusy(busy: boolean): void {
    if (!submitBtn) return;
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? messages.submitting : messages.submit;
  }

  function buildPayload(): Record<string, unknown> {
    return {
      locale: rawValue('locale'),
      name: rawValue('name'),
      email: rawValue('email'),
      preferredChannel: rawValue('preferredChannel'),
      contactValue: rawValue('contactValue'),
      country: rawValue('country'),
      city: rawValue('city'),
      interestClass: rawValue('interestClass'),
      breedPreference: rawValue('breedPreference'),
      sexPreference: rawValue('sexPreference'),
      colorPreference: rawValue('colorPreference'),
      timing: rawValue('timing'),
      videoCallReady: rawValue('videoCallReady') !== '',
      sourceChannel: rawValue('sourceChannel'),
      homeExperience: rawValue('homeExperience'),
      wishes: rawValue('wishes'),
      gdprConsent: rawValue('gdprConsent') !== '',
      company: honeypot ? honeypot.value : '',
      ts: tsField ? Number(tsField.value) : 0,
      turnstileToken:
        (form!.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value ?? '',
    };
  }

  function showSuccess(): void {
    form!.classList.add('hidden');
    if (successPanel) {
      successPanel.classList.remove('hidden');
      successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();

    // Honeypot tripped → silently stop (no feedback for bots).
    if (honeypot && honeypot.value.trim() !== '') return;

    const invalid = validate();
    if (invalid.length > 0) {
      const consentOnly = invalid.length === 1 && invalid[0] === 'gdprConsent';
      showSummary(consentOnly ? messages.errorConsent : messages.errorValidation);
      focusField(invalid[0]);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });

      let data: { ok?: boolean; error?: string; fields?: string[] } = {};
      try {
        data = await res.json();
      } catch {
        // non-JSON response (e.g. endpoint absent in Gate 1) → treat as server error
      }

      if (res.ok && data.ok) {
        showSuccess();
        return;
      }

      if (res.status === 422) {
        for (const name of data.fields ?? []) setFieldInvalid(name, true);
        showSummary(messages.errorValidation);
        if (data.fields && data.fields.length) focusField(data.fields[0]);
      } else if (res.status === 400 && data.error === 'consent') {
        setFieldInvalid('gdprConsent', true);
        showSummary(messages.errorConsent);
      } else {
        showSummary(messages.errorServer);
      }
    } catch {
      showSummary(messages.errorNetwork);
    } finally {
      setBusy(false);
    }
  });
}
