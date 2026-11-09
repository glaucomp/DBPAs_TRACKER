import { useEffect, useState } from 'react';
import { Activity, CalendarClock, FileStack, Hourglass } from 'lucide-react';
import {
  groupOverview,
  matchesMetric,
  matchesStatusFocus,
  metrics,
  overviewNotice,
  statusChart,
  UNCONFIGURED_STATUS,
} from '../model.js';
import { DueDate, PriorityBadge, StatusBadge, statusBarFill } from './Badges.jsx';
import { DataTable } from './DataTable.jsx';
import { Button, EmptyState } from './ui.jsx';

export function Overview({ projects, statuses, onEdit, onSample, sampling, registerIsEmpty, searching, onOpenIssued }) {
  const [focus, setFocus] = useState(null);
  const [statusFocus, setStatusFocus] = useState(null);
  const summary = metrics(projects);
  const listed = focus ? projects.filter((project) => matchesMetric(project, focus)) : projects;
  const chart = statusChart(listed, statuses);
  const statusActive = statusFocus && chart.some((bar) => bar.label === statusFocus) ? statusFocus : null;
  const statusLabels = statusActive === UNCONFIGURED_STATUS ? new Set(statuses.map((option) => option.label)) : null;
  const narrowed = statusActive
    ? listed.filter((project) =>
        statusActive === UNCONFIGURED_STATUS
          ? !statusLabels.has(project.status)
          : matchesStatusFocus(project, statusActive, statuses),
      )
    : listed;
  const { sections, unassigned } = groupOverview(narrowed, statuses);
  const open = sections.length > 0 || unassigned.length > 0;
  const notice = overviewNotice(focus, {
    open: open || chart.length > 0,
    projectCount: projects.length,
    registerIsEmpty,
    searching,
  });

  useEffect(() => {
    if (statusFocus && !statusActive) setStatusFocus(null);
  }, [statusFocus, statusActive]);

  function chooseMetric(metric) {
    if (metric === 'issuances') {
      onOpenIssued();
      return;
    }
    setFocus((current) => (current === metric ? null : metric));
  }

  function chooseStatus(label) {
    setStatusFocus((current) => (current === label ? null : label));
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Activity} label="Open jobs" value={summary.active} detail="Excludes completed work" pressed={focus === 'active'} onClick={() => chooseMetric('active')} />
        <Metric icon={CalendarClock} label="Due this month" value={summary.due} detail="Includes anything overdue" pressed={focus === 'due'} onClick={() => chooseMetric('due')} />
        <Metric icon={Hourglass} label="Waiting for approval" value={summary.approval} detail="Held for a decision" pressed={focus === 'approval'} onClick={() => chooseMetric('approval')} />
        <Metric icon={FileStack} label="Issued DBPAs" value={summary.issuances} detail="Across every project" onClick={() => chooseMetric('issuances')} />
      </section>
      {focus || statusActive ? (
        <p role="status" className="text-sm font-semibold text-navy-800">
          {focus === 'active' ? `Showing all ${summary.active} open jobs.` : null}
          {focus === 'due' ? `Showing ${summary.due} jobs due this month, including overdue.` : null}
          {focus === 'approval' ? `Showing ${summary.approval} ${summary.approval === 1 ? 'job' : 'jobs'} waiting for approval.` : null}
          {statusActive ? `${focus ? ' ' : ''}Filtered to ${statusActive}.` : null}
        </p>
      ) : null}

      {chart.length > 0 ? (
        <StatusChart bars={chart} pressed={statusActive} onChoose={chooseStatus} />
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

      {statusActive && !open && chart.length > 0 ? (
        <EmptyState title={`Nothing in ${statusActive}`}>
          Choose another status, or clear the filter by clicking the bar again.
        </EmptyState>
      ) : null}

      {sections.map(([status, rows]) => (
        <ProjectGroup key={status} title={status} rows={rows} onEdit={onEdit} showStatus={false} />
      ))}
      {unassigned.length > 0 ? (
        <ProjectGroup title={UNCONFIGURED_STATUS} rows={unassigned} onEdit={onEdit} showStatus />
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

function StatusChart({ bars, pressed, onChoose }) {
  const total = bars.reduce((sum, bar) => sum + bar.count, 0);
  const overdue = bars.reduce((sum, bar) => sum + bar.overdue, 0);
  const shares = sharePercents(bars, total);

  return (
    <section className="rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Open jobs by status</h2>
        <p className="text-xs text-muted">
          <span className="font-semibold tabular-nums text-navy-900">{total}</span> open
          {overdue > 0 ? (
            <>
              {' · '}
              <span className="font-semibold text-red-700">{overdue} overdue</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="mt-2 flex h-2.5 gap-px overflow-hidden rounded-full bg-white" aria-hidden="true">
        {bars.map((bar) => {
          const selected = pressed === bar.label;
          return (
            <span
              key={bar.label}
              className={`h-full ${statusBarFill(bar.label)} ${pressed && !selected ? 'opacity-30' : ''}`}
              style={{ flex: `${bar.count} 1 0` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 grid grid-cols-1 gap-x-4 sm:grid-cols-2" role="group" aria-label="Open jobs by status">
        {bars.map((bar, index) => {
          const selected = pressed === bar.label;
          const share = shares[index];
          return (
            <button
              key={bar.label}
              type="button"
              aria-pressed={selected}
              aria-label={`${bar.label}, ${bar.count} open ${bar.count === 1 ? 'job' : 'jobs'}, ${share} percent${bar.overdue ? `, ${bar.overdue} overdue` : ''}`}
              title={bar.overdue ? `${bar.label}: ${bar.overdue} overdue` : bar.label}
              onClick={() => onChoose(bar.label)}
              className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 ${selected ? 'bg-sky-100 ring-2 ring-navy-800' : ''}`}
            >
              <span className={`size-2 shrink-0 rounded-full ${statusBarFill(bar.label)}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{bar.label}</span>
              {bar.overdue > 0 ? (
                <span className="shrink-0 text-[11px] font-bold text-red-700">{bar.overdue} overdue</span>
              ) : null}
              <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-navy-900">{bar.count}</span>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">{share}%</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function sharePercents(bars, total) {
  if (total <= 0) return bars.map(() => 0);
  const raw = bars.map((bar) => (bar.count / total) * 100);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  const percents = [...floors];
  for (let index = 0; index < order.length && remainder > 0; index += 1) {
    percents[order[index].index] += 1;
    remainder -= 1;
  }
  return percents;
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
