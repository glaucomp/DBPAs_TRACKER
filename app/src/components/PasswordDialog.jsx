import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Alert, Button, Field, controlClass } from './ui.jsx';

export function PasswordDialog({ onClose, onSaved }) {
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  const [form, setForm] = useState({ current: '', next: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    const onCancel = (event) => {
      event.preventDefault();
      if (!savingRef.current) onClose();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
    };
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setSaving(true);
    savingRef.current = true;
    setError('');
    try {
      await api('/password', { method: 'POST', body: form });
      onSaved();
    } catch (caught) {
      setError(caught.message);
      setSaving(false);
      savingRef.current = false;
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="password-title" className="w-[min(440px,calc(100vw-2rem))] rounded-2xl shadow-2xl">
      <form onSubmit={submit} className="grid gap-4 p-6">
        <h2 id="password-title" className="font-display text-2xl text-navy-900">Change password</h2>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Current password">
          <input className={controlClass} type="password" required autoComplete="current-password" value={form.current} onChange={(event) => setForm({ ...form, current: event.target.value })} />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <input className={controlClass} type="password" required minLength={8} maxLength={200} autoComplete="new-password" value={form.next} onChange={(event) => setForm({ ...form, next: event.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Update password'}</Button>
        </div>
      </form>
    </dialog>
  );
}
