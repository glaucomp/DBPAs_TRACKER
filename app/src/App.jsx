import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, setUnauthorizedHandler } from './api.js';
import { filterProjects, issuedRows, labelsFor, VIEWS } from './model.js';
import { AuthScreen, BootScreen } from './components/AuthScreen.jsx';
import { IssuedTable } from './components/IssuedTable.jsx';
import { Overview, ProjectColumns } from './components/Overview.jsx';
import { PasswordDialog } from './components/PasswordDialog.jsx';
import { ProjectForm } from './components/ProjectForm.jsx';
import { SetupView } from './components/SetupView.jsx';
import { Shell } from './components/Shell.jsx';
import { Button, EmptyState, controlClass } from './components/ui.jsx';

export default function App() {
  const [boot, setBoot] = useState({ loading: true });

  const load = useCallback(() => {
    setBoot({ loading: true });
    api('/session')
      .then(async (session) => {
        if (!session.user) {
          setBoot({ loading: false, session });
          return;
        }
        setBoot({ loading: false, session: await api('/state') });
      })
      .catch((error) => setBoot({ loading: false, error: error.message }));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setBoot({ loading: false, session: { installed: true, user: null } });
    });
    load();
  }, [load]);

  if (boot.loading) {
    return <BootScreen title="Opening the tracker" body="Checking your sign-in and the project register." />;
  }

  if (boot.error) {
    return (
      <BootScreen
        title="The tracker cannot reach the database"
        body={boot.error}
        action={<Button onClick={load}>Try again</Button>}
      />
    );
  }

  if (!boot.session?.user) {
    return (
      <AuthScreen
        installed={Boolean(boot.session?.installed)}
        onSuccess={(session) => setBoot({ loading: false, session })}
      />
    );
  }

  return <Tracker initial={boot.session} onSignOut={() => setBoot({ loading: false, session: { installed: true, user: null } })} />;
}

function Tracker({ initial, onSignOut }) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState('overview');
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState(() => initialOwner(initial));
  const [editor, setEditor] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [sampling, setSampling] = useState(false);
  const closeEditor = useCallback(() => setEditor(null), []);
  const closePassword = useCallback(() => setPasswordOpen(false), []);

  useEffect(() => {
    const labels = labelsFor(data.options, 'owner');
    if (owner && !labels.includes(owner)) setOwner(labels[0] || '');
  }, [data.options, owner]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const visible = filterProjects(data.projects, { query, owner: view === 'mine' ? owner : '' });
  const current = VIEWS.find((item) => item.id === view);
  const owners = labelsFor(data.options, 'owner');

  function selectView(id) {
    setView(id);
    setQuery('');
    setNotice(null);
  }

  async function handleSubmit(payload) {
    let next;
    let text;
    if (editor.mode === 'date') {
      next = await api(`/issuances/${editor.issuance.id}`, { method: 'PATCH', body: payload });
      text = `${editor.project.number} issue date updated.`;
    } else if (editor.mode === 'edit') {
      next = await api(`/projects/${editor.project.id}`, { method: 'PUT', body: payload });
      text = `${payload.number} saved.`;
    } else {
      next = await api('/projects', { method: 'POST', body: { ...payload, issuedOnly: Boolean(editor.issuedOnly) } });
      text = `${payload.number} added.`;
    }
    setData(next);
    setEditor(null);
    setNotice({ id: Date.now(), text });
  }

  async function handleDelete() {
    const next = await api(`/projects/${editor.project.id}`, { method: 'DELETE' });
    const number = editor.project.number;
    setData(next);
    setEditor(null);
    setNotice({ id: Date.now(), text: `${number} deleted.` });
  }

  async function loadSample() {
    setSampling(true);
    try {
      setData(await api('/sample', { method: 'POST' }));
      setNotice({ id: Date.now(), text: 'Sample projects loaded.' });
    } catch (error) {
      setNotice({ id: Date.now(), text: error.message });
    } finally {
      setSampling(false);
    }
  }

  async function logout() {
    await api('/logout', { method: 'POST' });
    onSignOut();
  }

  const emptyRegister = (
    <EmptyState
      title={query ? 'No projects match that search' : view === 'mine' ? `Nothing is assigned to ${owner || 'that person'}` : 'No projects yet'}
      action={!query && data.projects.length === 0 ? (
        <Button onClick={loadSample} disabled={sampling}>{sampling ? 'Loading sample…' : 'Load sample projects'}</Button>
      ) : null}
    >
      {query
        ? 'Try a project number, address, strata plan, or engineer.'
        : data.projects.length === 0
          ? 'Add a project, or load the sample jobs to see the register filled in.'
          : 'Choose another person, or clear the search.'}
    </EmptyState>
  );

  return (
    <Shell
      view={view}
      onView={selectView}
      query={query}
      onQuery={setQuery}
      user={data.user}
      onLogout={logout}
      onPassword={() => setPasswordOpen(true)}
    >
      <div className="mx-auto grid max-w-7xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-navy-900">{current.label}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{current.description}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {view === 'mine' ? (
              <label className="grid gap-1 text-sm font-semibold">
                Assigned to
                <select className={`${controlClass} min-w-44`} value={owner} onChange={(event) => setOwner(event.target.value)}>
                  {owners.map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
              </label>
            ) : null}
            {view === 'projects' || view === 'issued' ? (
              <Button onClick={() => setEditor({ mode: 'create', issuedOnly: view === 'issued' })}>
                <Plus size={16} aria-hidden="true" />
                Add project
              </Button>
            ) : null}
          </div>
        </div>

        {view === 'overview' ? (
          <Overview
            projects={visible}
            statuses={data.options.status || []}
            onEdit={(project) => setEditor({ mode: 'edit', project })}
            onSample={loadSample}
            sampling={sampling}
            registerIsEmpty={data.projects.length === 0}
            searching={query.trim() !== ''}
          />
        ) : null}

        {view === 'projects' || view === 'mine' ? (
          <ProjectColumns
            rows={visible.map((project) => ({ key: project.id, project }))}
            onEdit={(project) => setEditor({ mode: 'edit', project })}
            showStatus
            empty={emptyRegister}
          />
        ) : null}

        {view === 'issued' ? (
          <IssuedTable
            rows={issuedRows(visible)}
            onEdit={(row) => setEditor(row.historical
              ? { mode: 'date', project: row.project, issuance: row.issuance }
              : { mode: 'edit', project: row.project })}
            empty={query || data.projects.length > 0
              ? <EmptyState title="No issuances to show">Record an issuance from a project, or add a project from this view.</EmptyState>
              : emptyRegister}
          />
        ) : null}

        {view === 'setup' ? (
          <SetupView options={data.options} onState={setData} isAdmin={data.user.role === 'admin'} />
        ) : null}
      </div>

      {editor ? (
        <ProjectForm
          key={`${editor.mode}-${editor.project?.id || 'new'}-${editor.issuance?.id || ''}`}
          editor={editor}
          options={data.options}
          projects={data.projects}
          onClose={closeEditor}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
        />
      ) : null}

      {passwordOpen ? (
        <PasswordDialog
          onClose={closePassword}
          onSaved={() => {
            setPasswordOpen(false);
            setNotice({ id: Date.now(), text: 'Password updated.' });
          }}
        />
      ) : null}

      {notice ? (
        <div role="status" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-line bg-navy-900 px-4 py-3 text-sm text-white shadow-lg">
          {notice.text}
        </div>
      ) : null}
    </Shell>
  );
}

function initialOwner(data) {
  const labels = labelsFor(data.options, 'owner');
  if (labels.includes(data.user?.name)) return data.user.name;
  return labels[0] || '';
}
