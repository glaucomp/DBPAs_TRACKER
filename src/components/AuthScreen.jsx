import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Button, Field, controlClass } from './ui.jsx';

export function BootScreen({ title, body, action }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <img src="/core-logo.svg" alt="CORE Consulting Engineers" className="mx-auto h-8" />
        <h1 className="mt-6 font-display text-2xl text-navy-900">{title}</h1>
        {body ? <p className="mt-3 text-sm leading-6 text-muted">{body}</p> : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </main>
  );
}

export function AuthScreen({ installed, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (!installed && form.password !== form.confirm) {
      setError('The passwords do not match.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const path = installed ? '/login' : '/install';
      const body = installed
        ? { email: form.email, password: form.password }
        : form;
      onSuccess(await api(path, { method: 'POST', body }));
    } catch (caught) {
      setError(caught.message);
      setPending(false);
    }
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
      <section className="relative overflow-hidden bg-navy-900 px-6 py-8 text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="absolute -right-16 top-16 size-56 rounded-full bg-sky-500/20 blur-2xl" />
        <div className="absolute bottom-10 left-10 size-40 rounded-full bg-sky-500/10 blur-2xl" />
        <div className="relative w-fit rounded-xl bg-white px-4 py-3">
          <img src="/core-logo.svg" alt="CORE Consulting Engineers" className="h-7 w-auto" />
        </div>
        <div className="relative mt-10 max-w-xl lg:mt-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-500">Design register</p>
          <h1 className="mt-3 font-display text-4xl leading-tight lg:text-5xl">DBPA Tracker</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-white/75">
            Project stages, reviews, and issued DBPAs for CORE Consulting Engineers. One register, shared with the team.
          </p>
        </div>
        <p className="relative mt-8 text-sm text-white/50">Stored in your Hostinger MySQL database.</p>
      </section>

      <section className="flex items-center bg-paper px-6 py-10 lg:px-16">
        <form onSubmit={submit} className="mx-auto grid w-full max-w-md gap-4" noValidate={false}>
          <div>
            <h2 className="font-display text-3xl text-navy-900">{installed ? 'Sign in' : 'Create the administrator'}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {installed
                ? 'Use the email and password for your team account.'
                : 'This first account can add the rest of the team from Setup.'}
            </p>
          </div>

          {error ? <Alert>{error}</Alert> : null}

          {installed ? null : (
            <Field label="Name">
              <input className={controlClass} value={form.name} onChange={(event) => update('name', event.target.value)} required maxLength={80} autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <input className={controlClass} type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required maxLength={190} autoComplete="username" />
          </Field>
          <Field label="Password" hint={installed ? '' : 'At least 8 characters.'}>
            <input
              className={controlClass}
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              required
              minLength={8}
              maxLength={200}
              autoComplete={installed ? 'current-password' : 'new-password'}
            />
          </Field>
          {installed ? null : (
            <Field label="Confirm password">
              <input className={controlClass} type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={(event) => update('confirm', event.target.value)} required minLength={8} maxLength={200} autoComplete="new-password" />
            </Field>
          )}

          <div className="flex items-center justify-between gap-3">
            <button type="button" className="text-sm font-semibold text-navy-700" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? 'Hide password' : 'Show password'}
            </button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Please wait…' : installed ? 'Sign in' : 'Create administrator'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
