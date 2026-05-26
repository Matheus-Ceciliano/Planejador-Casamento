import { ReactNode } from 'react';

type Column<T> = {
  header: string;
  render: (row: T) => ReactNode;
};

export default function DataTable<T extends { id: string }>({ rows, columns }: { rows: T[]; columns: Column<T>[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-rosew-100 text-sm">
          <thead className="bg-rosew-50">
            <tr>
              {columns.map((column) => (
                <th key={column.header} className="px-4 py-3 text-left font-semibold text-stone-600">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rosew-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-rosew-50/60">
                {columns.map((column) => (
                  <td key={column.header} className="px-4 py-3 align-middle">
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
