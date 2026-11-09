import { useState } from 'react';
import { Activity, CalendarClock, FileStack, Hourglass } from 'lucide-react';
import { groupOverview, matchesMetric, metrics, overviewNotice } from '../model.js';
import { DueDate, PriorityBadge, StatusBadge } from './Badges.jsx';
import { DataTable } from './DataTable.jsx';
import { Button, EmptyState } from './ui.jsx';

export function Overview({ projects, statuses, onEdit, onSample, sampling, registerIsEmpty, searching, onOpenIssued }) {
  const [focus, setFocus] = useState(null);
  const summary = metrics(projects);
  const listed = focus ? projects.filter((project) => matchesMetric(project, focus)) : projects;
  const { sections, unassigned } = groupOverview(listed, statuses);
  const open = sections.length > 0 || unassigned.length > 0;
  const notice = overviewNotice(focus, {
    open,
    projectCount: projects.length,
    registerIsEmpty,
    searching,
  });

  function chooseMetric(metric) {
    if (metric === 'issuances') {
      onOpenIssued();
      return;
    }
    setFocus((current) => (current === metric ? null : metric));
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Activity} label="Open jobs" value={summary.active} detail="Excludes completed work" pressed={focus === 'active'} onClick={() => chooseMetric('active')} />
        <Metric icon={CalendarClock} label="Due this month" value={summary.due} detail="Includes anything overdue" pressed={focus === 'due'} onClick={() => chooseMetric('due')} />
        <Metric icon={Hourglass} label="Waiting for approval" value={summary.approval} detail="Held for a decision" pressed={focus === 'approval'} onClick={() => chooseMetric('approval')} />
        <Metric icon={FileStack} label="Issuances on file" value={summary.issuances} detail="Across every project" onClick={() => chooseMetric('issuances')} />
      </section>
      {focus ? (
        <p role="status" className="text-sm font-semibold text-navy-800">
          {focus === 'active' ? `Showing all ${summary.active} open jobs.` : null}
          {focus === 'due' ? `Showing ${summary.due} jobs due this month, including overdue.` : null}
          {focus === 'approval' ? `Showing ${summary.approval} ${summary.approval === 1 ? 'job' : 'jobs'} waiting for approval.` : null}
        </p>
      ) : null}

      {notice === 'sample' ? (
        <EmptyState
          title="The register is empty"
          action={<Button onClick={onSample} disabled={sampling}>{sampling ? 'Loading sample…' : 'Load sample projects'}</Button>}
        >
          Add the first project, or load the sample jobs to see how stages and issuances are organised. You can delete the samples afterwards.
        </EmptyState>
      ) : null}

      {notice === 'search' ? (
        <EmptyState title="No projects match that search">
          Try a project number, address, strata plan, or engineer.
        </EmptyState>
      ) : null}

      {notice === 'idle' ? (
        <EmptyState title="Nothing is open on the overview">
          Completed jobs stay in Projects{summary.issuedOnly ? ', and projects recorded only as issuances stay under Issued DBPAs' : ''}.
        </EmptyState>
      ) : null}

      {notice === 'filter' ? (
        <EmptyState title={focus === 'due' ? 'Nothing is due this month' : 'Nothing is waiting for approval'}>
          {focus === 'due'
            ? 'Jobs due this month, including anything overdue, show up here.'
            : 'Jobs held for a decision show up here.'}
        </EmptyState>
      ) : null}

      {sections.map(([status, rows]) => (
        <ProjectGroup key={status} title={status} rows={rows} onEdit={onEdit} showStatus={false} />
      ))}
      {unassigned.length > 0 ? (
        <ProjectGroup title="No configured status" rows={unassigned} onEdit={onEdit} showStatus />
      ) : null}

      {summary.completed > 0 || summary.issuedOnly > 0 ? (
        <p className="text-sm text-muted">
          {summary.completed > 0 ? `${summary.completed} completed ${summary.completed === 1 ? 'job is' : 'jobs are'} in Projects.` : ''}
          {summary.completed > 0 && summary.issuedOnly > 0 ? ' ' : ''}
          {summary.issuedOnly > 0 ? `${summary.issuedOnly} ${summary.issuedOnly === 1 ? 'project was' : 'projects were'} added from Issued DBPAs and left off this overview.` : ''}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, pressed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={typeof pressed === 'boolean' ? pressed : undefined}
      className={`relative z-10 flex w-full cursor-pointer flex-col rounded-2xl border p-4 text-left shadow-sm transition hover:border-navy-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 ${pressed ? 'border-navy-800 bg-sky-100 ring-2 ring-navy-800' : 'border-line bg-white'}`}
    >
      <span className="pointer-events-none flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</span>
        <span className={`grid size-9 place-items-center rounded-xl text-navy-800 ${pressed ? 'bg-white' : 'bg-sky-100'}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </span>
      <span className="pointer-events-none mt-3 font-display text-3xl text-navy-900">{value}</span>
      <span className="pointer-events-none mt-1 text-xs text-muted">{detail}</span>
    </button>
  );
}

function ProjectGroup({ title, rows, onEdit, showStatus }) {
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-xl text-navy-900">{title} <span className="text-base font-sans font-semibold text-muted">({rows.length})</span></h2>
      <ProjectColumns rows={rows.map((project) => ({ key: project.id, project }))} onEdit={onEdit} showStatus={showStatus} />
    </section>
  );
}

export function ProjectColumns({ rows, onEdit, showStatus, empty }) {
  const columns = [
    {
      key: 'number',
      label: 'Project no.',
      head: 'w-32',
      render: (row) => <span className="font-mono text-[13px] font-semibold tracking-wide">{row.project.number}</span>,
    },
    {
      key: 'address',
      label: 'Project address',
      render: (row) => <Address project={row.project} />,
    },
    {
      key: 'owner',
      label: 'Assigned',
      render: (row) => row.project.owner || '—',
    },
    ...(showStatus ? [{
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge value={row.project.status} />,
    }] : []),
    {
      key: 'due',
      label: 'Due',
      render: (row) => <DueDate value={row.project.due} status={row.project.status} />,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => <PriorityBadge value={row.project.priority} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      head: 'w-24',
      render: (row) => (
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-sm font-semibold text-navy-800 hover:bg-white"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(row.project);
          }}
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      onRow={(row) => onEdit(row.project)}
      empty={empty}
    />
  );
}

function Address({ project }) {
  const meta = [
    project.strata ? `Strata ${project.strata}` : '',
    project.stage || '',
    project.program || '',
    project.engineer || '',
    project.issuedAs ? `${project.issuedAs}${project.revision ? ` · Rev ${project.revision}` : ''}` : '',
  ].filter(Boolean);

  return (
    <div className="min-w-48">
      <div className="font-semibold text-ink">{project.name}</div>
      {meta.length > 0 ? <div className="mt-0.5 text-xs text-muted">{meta.join(' · ')}</div> : null}
      {project.notes ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{project.notes}</p> : null}
    </div>
  );
}
