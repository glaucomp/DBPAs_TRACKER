import { formatDate } from '../model.js';
import { DataTable } from './DataTable.jsx';

export function IssuedTable({ rows, onEdit, empty }) {
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
      render: (row) => (
        <div>
          <div className="font-semibold">{row.project.name}</div>
          <div className="text-xs text-muted">{row.project.owner || 'Unassigned'}</div>
        </div>
      ),
    },
    {
      key: 'issuedAs',
      label: 'Issued as',
      render: (row) => row.issuance.issuedAs,
    },
    {
      key: 'revision',
      label: 'Rev',
      head: 'w-20',
      render: (row) => row.issuance.revision || '—',
    },
    {
      key: 'issueDate',
      label: 'Issue date',
      render: (row) => formatDate(row.issuance.issueDate),
    },
    {
      key: 'engineer',
      label: 'Engineer',
      render: (row) => row.project.engineer || '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      head: 'w-28',
      render: (row) => (
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-sm font-semibold text-navy-800 hover:bg-white"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(row);
          }}
        >
          {row.historical ? 'Edit date' : 'Edit'}
        </button>
      ),
    },
  ];

  return <DataTable rows={rows} columns={columns} onRow={onEdit} empty={empty} />;
}
