import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareDue,
  filterProjects,
  formatDate,
  groupOverview,
  issuedRows,
  metrics,
  statusRank,
} from '../src/model.js';

const statuses = [
  'New Job',
  'In Progress',
  'On Hold',
  'Approved',
  'For Update / Revision',
  'Waiting for Approval',
  'Upcoming Projects',
  'Completed',
].map((label, id) => ({ id, label }));

const projects = [
  { id: 1, number: 'DEMO-103', name: 'Westcourt', strata: '', owner: 'Unassigned', status: 'New Job', due: '', engineer: '', notes: '', issuedOnly: false, issuances: [] },
  { id: 2, number: 'DEMO-101', name: 'Harbour', strata: 'SP 1', owner: 'Stella', status: 'In Progress', due: '2026-11-18', engineer: 'A', notes: 'revisions', issuedOnly: false, issuances: [] },
  { id: 3, number: 'DEMO-105', name: 'Bridgeview', strata: '', owner: 'Jelly', status: 'For Update / Revision', due: '2026-11-12', engineer: '', notes: '', issuedOnly: false, issuances: [] },
  { id: 4, number: 'DEMO-104', name: 'Cedar', strata: '', owner: 'Stella', status: 'Completed', due: '2026-11-01', engineer: '', notes: '', issuedOnly: false, issuances: [
    { id: 1, issuedAs: 'For Tender', revision: 'B', issueDate: '2026-10-20' },
    { id: 2, issuedAs: 'For Construction', revision: 'C', issueDate: '2026-11-04' },
  ] },
  { id: 5, number: 'DEMO-106', name: 'Direct issue', strata: '', owner: 'Stella', status: 'Approved', due: '', engineer: '', notes: '', issuedOnly: true, issuances: [
    { id: 3, issuedAs: 'Draft', revision: 'A', issueDate: '' },
  ] },
  { id: 6, number: 'DEMO-107', name: 'Odd status', strata: '', owner: 'Jelly', status: 'Mystery', due: '2026-11-09', engineer: '', notes: '', issuedOnly: false, issuances: [] },
];

test('status groups follow the working order and hide completed or direct issuances', () => {
  const { sections, unassigned } = groupOverview(projects, statuses);
  assert.deepEqual(sections.map(([status]) => status), [
    'In Progress',
    'For Update / Revision',
    'New Job',
  ]);
  assert.equal(statusRank('In Progress'), 0);
  assert.equal(statusRank('New Job'), 8);
  assert.deepEqual(unassigned.map((project) => project.number), ['DEMO-107']);
  assert.equal(sections.flatMap(([, rows]) => rows).some((project) => project.number === 'DEMO-104'), false);
  assert.equal(sections.flatMap(([, rows]) => rows).some((project) => project.issuedOnly), false);
});

test('due dates sort soonest first and undated projects last', () => {
  const rows = [
    { number: 'B', due: '' },
    { number: 'A', due: '2026-12-01' },
    { number: 'C', due: '2026-11-02' },
  ].sort(compareDue);
  assert.deepEqual(rows.map((row) => row.number), ['C', 'A', 'B']);
});

test('issued history keeps earlier revisions marked and sorts newest dates first', () => {
  const rows = issuedRows(projects);
  assert.equal(rows[0].project.number, 'DEMO-104');
  assert.equal(rows[0].issuance.revision, 'C');
  assert.equal(rows[0].historical, false);
  assert.equal(rows.find((row) => row.issuance.revision === 'B').historical, true);
  assert.equal(rows.at(-1).issuance.issueDate, '');
});

test('search matches number, address, strata, engineer, and notes', () => {
  assert.deepEqual(filterProjects(projects, { query: 'sp 1' }).map((project) => project.number), ['DEMO-101']);
  assert.deepEqual(filterProjects(projects, { query: 'revision', owner: 'Stella' }).map((project) => project.number), ['DEMO-101']);
  assert.equal(filterProjects(projects, { owner: 'Jelly' }).length, 2);
});

test('dates format for Australia and metrics count open work', () => {
  assert.equal(formatDate('2026-11-18'), '18 Nov 2026');
  assert.equal(formatDate(''), '—');
  const summary = metrics(projects, '2026-11-09');
  assert.equal(summary.active, 4);
  assert.equal(summary.completed, 1);
  assert.equal(summary.issuedOnly, 1);
  assert.equal(summary.issuances, 3);
  assert.equal(summary.due, 2);
  assert.equal(summary.approval, 0);
});
