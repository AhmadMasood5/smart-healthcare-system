import { CartesianGrid, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';

// Status palette: score bands Low (<=7), Medium (8-14), High (>=15).
const BAND = (score) => (score >= 15 ? '#d03b3b' : score >= 8 ? '#fab219' : '#0ca30c');

function RiskTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <div className="font-semibold text-slate-900">
        #{r.rank} {r.riskId} — {r.title}
      </div>
      <div>
        Likelihood {r.likelihood} × Impact {r.impact} = <strong>{r.score}</strong> ({r.priority})
      </div>
    </div>
  );
}

function RiskDot({ cx, cy, payload }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={13} fill="#0f172a" stroke="#ffffff" strokeWidth={2} />
      <text x={cx} y={cy} dy={4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#ffffff">
        {payload.rank}
      </text>
    </g>
  );
}

// 5x5 likelihood/impact grid built from backend matrix cells; dots are numbered by priority rank.
export default function RiskMatrix({ matrix }) {
  const points = [];
  for (const cell of matrix.cells) {
    cell.risks.forEach((r, i) => {
      const spread = (i - (cell.risks.length - 1) / 2) * 0.28;
      const full = matrix.ranked.find((x) => x._id === r._id);
      points.push({ ...full, x: cell.likelihood + spread, y: cell.impact });
    });
  }
  return (
    <div style={{ height: 440 }} data-testid="risk-matrix">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
          <CartesianGrid stroke="#ffffff" />
          {matrix.cells.map((c) => (
            <ReferenceArea
              key={`${c.likelihood}-${c.impact}`}
              x1={c.likelihood - 0.5}
              x2={c.likelihood + 0.5}
              y1={c.impact - 0.5}
              y2={c.impact + 0.5}
              fill={BAND(c.score)}
              fillOpacity={0.22}
              stroke="#ffffff"
              strokeWidth={2}
              label={{ value: c.score, position: 'insideTopLeft', fontSize: 10, fill: '#475569' }}
            />
          ))}
          <XAxis
            type="number"
            dataKey="x"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 12, fill: '#334155' }}
            label={{ value: 'Likelihood (1 = rare, 5 = almost certain)', position: 'bottom', offset: 10, fontSize: 12, fill: '#334155' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 12, fill: '#334155' }}
            label={{ value: 'Impact', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#334155' }}
          />
          <Tooltip content={<RiskTooltip />} cursor={false} />
          <Scatter data={points} shape={<RiskDot />} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export { BAND };
