import { useEffect, useRef, useState } from 'react';
import { ISSUANCE_TYPES, labelsFor } from '../model.js';
import { Alert, Button, Field, controlClass } from './ui.jsx';

const PROJECT_FIELDS = [
  { key: 'number', label: 'Project no.', type: 'text', required: true, max: 40 },
  { key: 'strata', label: 'Strata plan', type: 'text', max: 120 },
  { key: 'name', label: 'Project address', type: 'text', required: true, max: 255 },
  { key: 'owner', label: 'To be done by', type: 'select' },
  { key: 'category', label: 'Category', type: 'select' },
  { key: 'program', label: 'Program', type: 'select' },
];

const SCHEDULE_FIELDS = [
  { key: 'stage', label: 'Project stage', type: 'select' },
  { key: 'status', label: 'Status', type: 'select' },
  { key: 'start', label: 'Start date', type: 'date' },
  { key: 'review', label: 'To be reviewed', type: 'text', max: 255 },
  { key: 'due', label: 'Due date', type: 'date' },
  { key: 'engineer', label: 'Engineer', type: 'select' },
  { key: 'priority', label: 'Priority', type: 'select' },
];

function blank(options, issuedOnly) {
  const owners = labelsFor(options, 'owner');
  const statuses = labelsFor(options, 'status');
  return {
    number: '',
    strata: '',
    name: '',
    owner: owners.includes('Unassigned') ? 'Unassigned' : '',
    category: '',
    program: '',
    stage: '',
    status: !issuedOnly && statuses.includes('New Job') ? 'New Job' : '',
    start: '',
    review: '',
    due: '',
    engineer: '',
    priority: '',
    issuedAs: '',
    revision: '',
    issueDate: '',
    notes: '',
  };
}

function fromProject(project, issuance) {
  return {
    number: project.number || '',
    strata: project.strata || '',
    name: project.name || '',
    owner: project.owner || '',
    category: project.category || '',
    program: project.program || '',
    stage: project.stage || '',
    status: project.status || '',
    start: project.start || '',
    review: project.review || '',
    due: project.due || '',
    engineer: project.engineer || '',
    priority: project.priority || '',
    issuedAs: project.issuedAs || '',
    revision: project.revision || '',
    issueDate: issuance?.issueDate ?? project.issueDate ?? '',
    notes: project.notes || '',
  };
}

export function ProjectForm({ editor, options, projects, onClose, onSubmit, onDelete }) {
  const dialogRef = useRef(null);
  const editedDate = useRef(false);
  const savingRef = useRef(false);
  const historical = editor.mode === 'date';
  const [form, setForm] = useState(() => (
    editor.mode === 'create' ? blank(options, editor.issuedOnly) : fromProject(editor.project, editor.issuance)
  ));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setIssuance(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (editedDate.current) return next;
      const latest = editor.project?.issuances?.at(-1);
      const same = latest && latest.issuedAs === next.issuedAs && latest.revision === next.revision.trim();
      next.issueDate = same ? (latest.issueDate || '') : '';
      return next;
    });
  }

  const issuedRequired = editor.issuedOnly || (editor.project?.issuances?.length > 0);
  const title = historical
    ? `Edit issuance · ${editor.project.number} · ${editor.issuance.issuedAs} · Rev ${editor.issuance.revision || '—'}`
    : editor.mode === 'edit' ? 'Edit project' : 'Add project';

  async function submit(event) {
    event.preventDefault();
    if (confirming) return;
    if (!event.currentTarget.reportValidity()) return;
    const number = form.number.trim().toUpperCase();
    if (!historical && projects.some((project) => project.id !== editor.project?.id && project.number.toUpperCase() === number)) {
      setError('This project number already exists.');
      return;
    }
    setSaving(true);
    savingRef.current = true;
    setError('');
    try {
      if (historical) {
        await onSubmit({ issueDate: form.issueDate });
      } else {
        await onSubmit({ ...form, number, name: form.name.trim() });
      }
    } catch (caught) {
      setError(caught.message);
      setSaving(false);
      savingRef.current = false;
    }
  }

  async function remove() {
    setSaving(true);
    savingRef.current = true;
    setError('');
    try {
      await onDelete();
    } catch (caught) {
      setError(caught.message);
      setSaving(false);
      savingRef.current = false;
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="project-form-title"
      className="w-[min(820px,calc(100vw-2rem))] rounded-2xl shadow-2xl"
      onClick={(event) => {
        if (!saving && event.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={submit} className="max-h-[calc(100dvh-2rem)] overflow-auto">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white px-6 py-5">
          <div>
            <h2 id="project-form-title" className="font-display text-2xl text-navy-900">{title}</h2>
            {historical ? (
              <p className="mt-1 text-sm text-muted">Earlier issuances stay in the history. Only the issue date can change here.</p>
            ) : (
              <p id="issue-hint" className="mt-1 text-sm text-muted">
                {editor.issuedOnly
                  ? 'This project is recorded from an issuance, so it is left off the status overview.'
                  : 'To record a new issuance, choose Issued as and enter its revision. Earlier issuances stay in the history.'}
              </p>
            )}
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:bg-paper" onClick={onClose} disabled={saving}>
            Close
          </button>
        </header>

        <div className="grid gap-6 px-6 py-5">
          {error ? <Alert>{error}</Alert> : null}
          {historical ? (
            <Field label="Issue date">
              <input className={controlClass} type="date" value={form.issueDate} onChange={(event) => setField('issueDate', event.target.value)} autoFocus />
            </Field>
          ) : (
            <>
              <FormSection title="Project" fields={PROJECT_FIELDS} form={form} options={options} onChange={setField} />
              <FormSection title="Schedule" fields={SCHEDULE_FIELDS} form={form} options={options} onChange={setField} />
              <section className="grid gap-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Issuance</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Issued as">
                    <select className={controlClass} value={form.issuedAs} required={issuedRequired} onChange={(event) => setIssuance('issuedAs', event.target.value)}>
                      <option value="">Not issued</option>
                      {ISSUANCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field label="Revision">
                    <input className={controlClass} value={form.revision} maxLength={40} placeholder="e.g. C" onChange={(event) => setIssuance('revision', event.target.value)} />
                  </Field>
                  <Field label="Issue date">
                    <input
                      className={controlClass}
                      type="date"
                      value={form.issueDate}
                      onChange={(event) => {
                        editedDate.current = true;
                        setField('issueDate', event.target.value);
                      }}
                    />
                  </Field>
                </div>
              </section>
              <Field label="Notes">
                <textarea className={`${controlClass} min-h-28 resize-y`} value={form.notes} maxLength={5000} onChange={(event) => setField('notes', event.target.value)} />
              </Field>
            </>
          )}

          {confirming ? (
            <section className="rounded-xl border border-red-200 bg-red-50 p-4" aria-labelledby="delete-message">
              <p id="delete-message" className="text-sm text-red-900">
                Delete project {editor.project.number} and its issuance history? This cannot be undone.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={saving}>Keep project</Button>
                <Button variant="danger" onClick={remove} disabled={saving}>{saving ? 'Deleting…' : 'Delete project permanently'}</Button>
              </div>
            </section>
          ) : null}
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-6 py-4">
          {editor.mode === 'edit' && !historical ? (
            <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setConfirming(true)} disabled={saving || confirming}>
              Delete project
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || confirming}>{saving && !confirming ? 'Saving…' : 'Save'}</Button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}

function FormSection({ title, fields, form, options, onChange }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className={field.key === 'name' ? 'sm:col-span-2' : ''}>
            <Control field={field} value={form[field.key]} options={options} onChange={onChange} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Control({ field, value, options, onChange }) {
  if (field.type === 'select') {
    const choices = labelsFor(options, field.key);
    if (value && !choices.includes(value)) choices.unshift(value);
    return (
      <Field label={field.label}>
        <select className={controlClass} value={value} onChange={(event) => onChange(field.key, event.target.value)}>
          <option value="">Select an option</option>
          {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </select>
      </Field>
    );
  }

  return (
    <Field label={field.label}>
      <input
        className={controlClass}
        type={field.type}
        value={value}
        required={field.required}
        maxLength={field.max}
        autoFocus={field.key === 'number'}
        onChange={(event) => onChange(field.key, field.key === 'number' ? event.target.value.toUpperCase() : event.target.value)}
      />
    </Field>
  );
}
