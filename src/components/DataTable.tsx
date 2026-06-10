import { ReactNode } from 'react';

type Column<T> = {
  header: string;
  render: (row: T) => ReactNode;
};

export default function DataTable<T extends { id: string }>({ rows, columns }: { rows: T[]; columns: Column<T>[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-w-border text-sm leading-5">
          <thead className="bg-w-surface">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.header}
                  className="px-4 py-3 text-left text-xs font-semibold leading-4 uppercase tracking-wide text-w-faint"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-w-border bg-w-card">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="transition-colors duration-100 hover:bg-w-surface"
              >
                {columns.map((column) => (
                  <td key={column.header} className="px-4 py-3.5 align-middle">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
