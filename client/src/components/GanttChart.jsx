import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { daysBetween, formatDate } from '../utils/formatters';

const COLORS = { done: '#184f95', remaining: '#86b6ef', slip: '#d03b3b', deadline: '#d03b3b', today: '#52514e', milestone: '#6250d6' };

function GanttTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const t = payload[0].payload.task;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-900">
        {t.taskId} — {t.title}
      </div>
      <div>Assigned: {t.assignedTo ? t.assignedTo.name : 'Unassigned'}</div>
      <div>
        Planned: {formatDate(t.plannedStart)} → {formatDate(t.plannedEnd)} ({t.estimatedDuration} days)
      </div>
      <div>Forecast finish: {formatDate(t.forecastEnd)}</div>
      <div>
        Progress: {t.progress}% · {t.status}
      </div>
      {t.delayDays > 0 && (
        <div className="mt-1 font-medium text-red-700">
          Delayed {t.delayDays} day(s) — {t.delayCause}
        </div>
      )}
    </div>
  );
}

function TaskTick({ x, y, payload, rows }) {
  const row = rows.find((r) => r.name === payload.value);
  const delayed = row && row.task.isDelayed;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill={delayed ? '#b91c1c' : '#334155'} fontWeight={delayed ? 600 : 400}>
      {delayed ? '⚠ ' : ''}
      {payload.value}
    </text>
  );
}

// Gantt-style timeline: planned bar split into completed / remaining work, with forecast slip in red.
export default function GanttChart({ schedule }) {
  if (!schedule || !schedule.tasks.length) return <p className="text-sm text-slate-500">No tasks to display.</p>;
  const start = schedule.projectStart;
  const offset = (d) => daysBetween(d, start);

  const rows = [...schedule.tasks]
    .sort((a, b) => new Date(a.plannedStart) - new Date(b.plannedStart) || a.taskId.localeCompare(b.taskId))
    .map((t) => {
      const done = (t.estimatedDuration * t.progress) / 100;
      return {
        name: `${t.taskId} ${t.title}`,
        offset: offset(t.plannedStart),
        done,
        remaining: t.estimatedDuration - done,
        slip: t.delayDays,
        task: t,
      };
    });

  const deadlineX = offset(schedule.deadline) + 1;
  const todayX = offset(schedule.reportDate);
  const maxX = Math.max(deadlineX, ...rows.map((r) => r.offset + r.done + r.remaining + r.slip)) + 3;
  const tickDate = (n) => formatDate(new Date(new Date(start).getTime() + n * 86400000)).slice(0, 6);
  const milestones = schedule.milestones.map((m, i) => ({ ...m, code: `M${i + 1}`, x: offset(m.plannedDate) + 1 }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600" aria-label="Gantt legend">
        <Legend color={COLORS.done} label="Completed work" />
        <Legend color={COLORS.remaining} label="Remaining planned work" />
        <Legend color={COLORS.slip} label="Forecast delay" />
        <Legend color={COLORS.deadline} label="Approved deadline" line dashed />
        <Legend color={COLORS.today} label="Today" line />
        <Legend color={COLORS.milestone} label="Milestone" line />
      </div>
      <div style={{ height: rows.length * 30 + 70 }} data-testid="gantt-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 20, right: 30, left: 10, bottom: 5 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" domain={[0, maxX]} tickFormatter={tickDate} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={240} tick={<TaskTick rows={rows} />} interval={0} />
            <Tooltip content={<GanttTooltip />} cursor={{ fill: 'rgba(148,163,184,0.15)' }} />
            <Bar dataKey="offset" stackId="g" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="done" stackId="g" fill={COLORS.done} isAnimationActive={false} />
            <Bar dataKey="remaining" stackId="g" fill={COLORS.remaining} isAnimationActive={false} />
            <Bar dataKey="slip" stackId="g" fill={COLORS.slip} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            {milestones.map((m) => (
              <ReferenceLine key={m.id} x={m.x} stroke={COLORS.milestone} strokeOpacity={0.6} label={{ value: m.code, position: 'top', fontSize: 10, fill: COLORS.milestone }} />
            ))}
            <ReferenceLine x={todayX} stroke={COLORS.today} label={{ value: 'Today', position: 'insideBottomRight', fontSize: 10, fill: COLORS.today }} />
            <ReferenceLine x={deadlineX} stroke={COLORS.deadline} strokeDasharray="5 4" strokeWidth={2} label={{ value: 'Deadline', position: 'insideTopRight', fontSize: 10, fill: COLORS.deadline }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2" aria-label="Milestones">
        {milestones.map((m) => (
          <li key={m.id}>
            <span className="font-semibold text-violet-700">◆ {m.code}</span> {m.title} — planned {formatDate(m.plannedDate)}
            {m.completionStatus === 'Completed' ? ` (completed ${formatDate(m.actualCompletionDate)})` : ` (forecast ${formatDate(m.forecastDate)})`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legend({ color, label, line, dashed }) {
  return (
    <span className="flex items-center gap-1.5">
      {line ? (
        <span className="inline-block w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
      ) : (
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}
