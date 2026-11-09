export function DataTable({ rows, columns, onRow, empty }) {
  if (!rows.length) return empty;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white shadow-sm md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-paper text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={`px-4 py-3 font-bold ${column.head || ''}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                onClick={() => onRow?.(row)}
                className="cursor-pointer border-t border-line transition hover:bg-sky-100/40"
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 align-middle ${column.cell || ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.key}>
            <article className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div className="grid gap-3">
                {columns.filter((column) => column.key !== 'actions').map((column) => (
                  <div key={column.key}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{column.label}</div>
                    <div className="mt-1">{column.render(row)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4">{columns.find((column) => column.key === 'actions')?.render(row)}</div>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
