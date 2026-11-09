import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { SETUP_FIELDS } from '../model.js';
import { Alert, Button, Field, controlClass } from './ui.jsx';

export function SetupView({ options, onState, isAdmin }) {
  const [field, setField] = useState(SETUP_FIELDS[0].key);
  const [drafts, setDrafts] = useState({});
  const [addition, setAddition] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('info');
  const [users, setUsers] = useState([]);
  const [person, setPerson] = useState({ name: '', email: '', password: '', role: 'member' });
  const [teamError, setTeamError] = useState('');
  const [teamsConfigured, setTeamsConfigured] = useState(false);
  const [teamsUrl, setTeamsUrl] = useState('');
  const [teamsMessage, setTeamsMessage] = useState('');
  const [teamsTone, setTeamsTone] = useState('info');
  const [teamsSaving, setTeamsSaving] = useState(false);

  const rows = options[field] || [];
  const showingTeams = field === 'teams';

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    api('/users').then((data) => {
      if (!ignore) setUsers(data.users || []);
    }).catch((error) => {
      if (!ignore) setTeamError(error.message);
    });
    api('/settings/teams').then((data) => {
      if (!ignore) setTeamsConfigured(Boolean(data.configured));
    }).catch((error) => {
      if (!ignore) {
        setTeamsTone('error');
        setTeamsMessage(error.message);
      }
    });
    return () => {
      ignore = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    const next = {};
    for (const option of rows) next[option.id] = option.label;
    setDrafts(next);
  }, [field, options]);

  function report(text, nextTone = 'info') {
    setTone(nextTone);
    setMessage(text);
  }

  async function addOption() {
    try {
      onState(await api('/options', { method: 'POST', body: { field, label: addition } }));
      setAddition('');
      report('Option added.');
    } catch (error) {
      report(error.message, 'error');
    }
  }

  async function saveOption(id) {
    try {
      onState(await api(`/options/${id}`, { method: 'PUT', body: { label: drafts[id] ?? '' } }));
      report('Option updated.');
    } catch (error) {
      report(error.message, 'error');
    }
  }

  async function removeOption(id) {
    try {
      onState(await api(`/options/${id}`, { method: 'DELETE' }));
      report('Option deleted.');
    } catch (error) {
      report(error.message, 'error');
    }
  }

  async function addPerson(event) {
    event.preventDefault();
    setTeamError('');
    try {
      const data = await api('/users', { method: 'POST', body: person });
      setUsers(data.users || []);
      setPerson({ name: '', email: '', password: '', role: 'member' });
    } catch (error) {
      setTeamError(error.message);
    }
  }

  async function removePerson(id) {
    setTeamError('');
    try {
      const data = await api(`/users/${id}`, { method: 'DELETE' });
      setUsers(data.users || []);
    } catch (error) {
      setTeamError(error.message);
    }
  }

  async function saveTeams(event) {
    event.preventDefault();
    setTeamsSaving(true);
    setTeamsMessage('');
    try {
      const data = await api('/settings/teams', { method: 'PUT', body: { webhookUrl: teamsUrl } });
      setTeamsConfigured(Boolean(data.configured));
      setTeamsUrl('');
      setTeamsTone('info');
      setTeamsMessage(data.configured ? 'Teams channel webhook saved.' : 'Teams webhook cleared.');
    } catch (error) {
      setTeamsTone('error');
      setTeamsMessage(error.message);
    } finally {
      setTeamsSaving(false);
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <div className="rounded-2xl border border-line bg-white p-2 shadow-sm">
          {SETUP_FIELDS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={field === item.key}
              onClick={() => {
                setField(item.key);
                setMessage('');
              }}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${field === item.key ? 'bg-navy-800 text-white' : 'text-ink hover:bg-paper'}`}
            >
              {item.label}
            </button>
          ))}
          {isAdmin ? (
            <>
              <div className="mx-2 my-1 border-t border-line" />
              <button
                type="button"
                aria-pressed={showingTeams}
                onClick={() => {
                  setField('teams');
                  setMessage('');
                }}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${showingTeams ? 'bg-navy-800 text-white' : 'text-ink hover:bg-paper'}`}
              >
                Microsoft Teams
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8">
        {showingTeams ? null : (
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl text-navy-900">{SETUP_FIELDS.find((item) => item.key === field)?.label}</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Field label="New option">
                <input className={controlClass} value={addition} maxLength={100} onChange={(event) => setAddition(event.target.value)} />
              </Field>
            </div>
            <Button onClick={addOption}>Add option</Button>
          </div>
          {message ? <div className="mt-4"><Alert tone={tone}>{message}</Alert></div> : null}
          <ul className="mt-5 grid gap-3">
            {rows.length === 0 ? <li className="text-sm text-muted">No options yet. Add the first one above.</li> : null}
            {rows.map((option) => (
              <li key={option.id} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <Field label="Option">
                    <input
                      className={controlClass}
                      maxLength={100}
                      value={drafts[option.id] ?? option.label}
                      onChange={(event) => setDrafts((current) => ({ ...current, [option.id]: event.target.value }))}
                    />
                  </Field>
                </div>
                <Button variant="secondary" onClick={() => saveOption(option.id)} aria-label={`Save option ${option.label}`}>Save</Button>
                <Button variant="secondary" onClick={() => removeOption(option.id)} aria-label={`Delete option ${option.label}`}>Delete</Button>
              </li>
            ))}
          </ul>
        </section>
        )}

        {isAdmin && !showingTeams ? (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <h2 className="font-display text-xl text-navy-900">Team</h2>
            <p className="mt-1 text-sm text-muted">Administrators can add people and remove other accounts. Everyone who can sign in can edit the register.</p>
            <form onSubmit={addPerson} className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Name">
                <input className={controlClass} required maxLength={80} value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} />
              </Field>
              <Field label="Email">
                <input className={controlClass} type="email" required maxLength={190} value={person.email} onChange={(event) => setPerson({ ...person, email: event.target.value })} />
              </Field>
              <Field label="Temporary password" hint="At least 8 characters. They can change it after signing in.">
                <input className={controlClass} type="text" required minLength={8} maxLength={200} autoComplete="new-password" value={person.password} onChange={(event) => setPerson({ ...person, password: event.target.value })} />
              </Field>
              <Field label="Role">
                <select className={controlClass} value={person.role} onChange={(event) => setPerson({ ...person, role: event.target.value })}>
                  <option value="member">Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Button type="submit">Add person</Button>
              </div>
            </form>
            {teamError ? <div className="mt-4"><Alert>{teamError}</Alert></div> : null}
            <ul className="mt-5 divide-y divide-line">
              {users.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-sm text-muted">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-navy-800">
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                    <Button variant="secondary" onClick={() => removePerson(member.id)}>Remove</Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isAdmin && showingTeams ? (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <h2 className="font-display text-xl text-navy-900">Microsoft Teams</h2>
            <p className="mt-1 text-sm text-muted">
              When a project is added, the tracker posts a short card to a Teams channel. Create a Workflows webhook in that channel
              (Post to a channel when a webhook request is received), then paste the URL here. The URL is stored in the database and is never shown again after you save.
            </p>
            <p className="mt-3 text-sm font-semibold text-navy-800">
              {teamsConfigured ? 'Channel webhook is configured.' : 'No channel webhook yet.'}
            </p>
            <form onSubmit={saveTeams} className="mt-4 grid gap-3">
              <Field
                label="Webhook URL"
                hint={teamsConfigured ? 'Paste a new URL to replace it, or leave blank and save to clear.' : 'Paste the https Workflows webhook URL.'}
              >
                <input
                  className={controlClass}
                  type="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://…"
                  value={teamsUrl}
                  onChange={(event) => setTeamsUrl(event.target.value)}
                />
              </Field>
              <div>
                <Button type="submit" disabled={teamsSaving}>
                  {teamsSaving ? 'Saving…' : 'Save Teams webhook'}
                </Button>
              </div>
            </form>
            {teamsMessage ? (
              <div className="mt-4">
                <Alert tone={teamsTone}>{teamsMessage}</Alert>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
