// columns: [{ key, header, render?: (row) => node, className? }]
export default function DataTable({ columns, rows, emptyMessage = 'No records yet.', rowKey = '_id', rowClassName, label }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm" aria-label={label}>
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${c.className || ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows && rows.length ? (
            rows.map((row) => (
              <tr key={row[rowKey]} className={rowClassName ? rowClassName(row) : ''}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 align-top text-slate-700 ${c.className || ''}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
