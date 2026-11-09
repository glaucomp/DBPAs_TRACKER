export const ISSUANCE_TYPES = ['Draft', 'For Information', 'For Tender', 'For Construction', 'As-Built'];

export const VIEWS = [
  { id: 'overview', label: 'Overview', description: 'Open work grouped by status.' },
  { id: 'projects', label: 'Projects', description: 'The full project register.' },
  { id: 'issued', label: 'Issued DBPAs', description: 'Every issuance, newest first. Earlier issues keep their history.' },
  { id: 'mine', label: 'My Projects', description: 'Filter the register by who the work is assigned to.' },
  { id: 'setup', label: 'Setup', description: 'Dropdown lists used on the project form, and team access for administrators.' },
];

export const SETUP_FIELDS = [
  { key: 'owner', label: 'To be done by' },
  { key: 'category', label: 'Category' },
  { key: 'program', label: 'Program' },
  { key: 'stage', label: 'Project stage' },
  { key: 'status', label: 'Status' },
  { key: 'engineer', label: 'Engineer' },
  { key: 'priority', label: 'Priority' },
];

const STATUS_RANK = new Map([
  ['in progress', 0],
  ['in progres', 0],
  ['for update / revision', 1],
  ['approved', 2],
  ['waiting for approval', 3],
  ['waiting approval', 3],
  ['upcoming projects', 4],
  ['on hold', 5],
]);

export function isCompleted(status) {
  return (status || '').trim().toLowerCase() === 'completed';
}

export function isOpenJob(project) {
  return !project.issuedOnly && !isCompleted(project.status);
}

export function isDueByMonthEnd(project, today = todayISO()) {
  return Boolean(project.due) && project.due <= endOfMonth(today);
}

export function isWaitingApproval(project) {
  return (project.status || '').trim().toLowerCase() === 'waiting for approval';
}

export function matchesMetric(project, metric, today = todayISO()) {
  if (!isOpenJob(project)) return false;
  if (metric === 'active') return true;
  if (metric === 'due') return isDueByMonthEnd(project, today);
  if (metric === 'approval') return isWaitingApproval(project);
  return false;
}

export function overviewNotice(focus, { open, projectCount, registerIsEmpty, searching }) {
  if (open) return null;
  if (registerIsEmpty && !searching) return 'sample';
  if (projectCount === 0) return 'search';
  if (focus === 'due' || focus === 'approval') return 'filter';
  return 'idle';
}

export function statusRank(status) {
  const rank = STATUS_RANK.get((status || '').trim().toLowerCase());
  return rank === undefined ? STATUS_RANK.size : rank;
}

export function todayISO(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function endOfMonth(iso) {
  const [year, month] = iso.split('-').map(Number);
  return todayISO(new Date(year, month, 0));
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return '—';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function compareDue(left, right) {
  if (!left.due && !right.due) return left.number.localeCompare(right.number);
  if (!left.due) return 1;
  if (!right.due) return -1;
  return left.due.localeCompare(right.due) || left.number.localeCompare(right.number);
}

export function filterProjects(projects, { query = '', owner = '' } = {}) {
  const needle = query.trim().toLowerCase();
  return projects.filter((project) => {
    if (owner && project.owner !== owner) return false;
    if (!needle) return true;
    return [project.number, project.name, project.strata, project.engineer, project.notes]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
}

export function groupOverview(projects, statusOptions) {
  const labels = statusOptions.map((option) => option.label);
  const byStatus = new Map(labels.map((status) => [status, []]));
  const unassigned = [];

  for (const project of projects) {
    if (project.issuedOnly || isCompleted(project.status)) continue;
    const bucket = byStatus.get(project.status);
    if (bucket) bucket.push(project);
    else unassigned.push(project);
  }

  const sections = [...byStatus.entries()]
    .filter(([, rows]) => rows.length > 0)
    .sort(([left], [right]) => statusRank(left) - statusRank(right) || labels.indexOf(left) - labels.indexOf(right));

  for (const [, rows] of sections) rows.sort(compareDue);
  unassigned.sort(compareDue);

  return { sections, unassigned };
}

export function issuedRows(projects) {
  const rows = [];
  for (const project of projects) {
    (project.issuances || []).forEach((issuance, index, history) => {
      rows.push({
        key: `${project.id}-${issuance.id ?? index}`,
        project,
        issuance,
        historical: index < history.length - 1,
      });
    });
  }

  rows.sort((left, right) => {
    const leftDate = left.issuance.issueDate || '';
    const rightDate = right.issuance.issueDate || '';
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
    return left.project.number.localeCompare(right.project.number);
  });

  return rows;
}

export function metrics(projects, today = todayISO()) {
  const active = projects.filter((project) => isOpenJob(project));
  return {
    active: active.length,
    due: active.filter((project) => isDueByMonthEnd(project, today)).length,
    approval: active.filter((project) => isWaitingApproval(project)).length,
    issuances: projects.reduce((total, project) => total + (project.issuances?.length || 0), 0),
    completed: projects.filter((project) => isCompleted(project.status)).length,
    issuedOnly: projects.filter((project) => project.issuedOnly).length,
  };
}

export function labelsFor(options, key) {
  return (options?.[key] || []).map((option) => option.label);
}
