'use client'

import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { DashboardData } from '@/lib/stats'
import { Card, CardBody } from '@/components/ui'

const AXIS = {
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  stroke: 'var(--fg-subtle)',
} as const

const shortDate = (d: string) => d.slice(5).replace('-', '/')

function TooltipBox({
  active, payload, label, unit,
}: {
  active?: boolean
  payload?: { value?: number | string }[]
  label?: string | number
  unit: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border-base bg-surface-raised px-3 py-2 text-xs shadow-[var(--shadow-lg)]">
      <p className="text-fg-subtle">{label}</p>
      <p className="tabular mt-0.5 font-semibold text-fg">
        {payload[0].value} {unit}
      </p>
    </div>
  )
}

function ChartCard({
  title, description, empty, emptyHint, children,
}: {
  title: string
  description?: string
  empty: boolean
  emptyHint: string
  children: React.ReactElement
}) {
  return (
    <Card>
      <CardBody>
        <div className="mb-3">
          <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
        </div>

        {empty ? (
          <p className="py-12 text-center text-sm text-fg-subtle">{emptyHint}</p>
        ) : (
          <div className="-ml-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

export default function Charts({ data, target }: { data: DashboardData; target: number }) {
  const loggedDays = data.calorieSeries.filter((p) => p.kcal !== null).length

  return (
    <div className="stagger flex flex-col gap-4">
      <ChartCard
        title="Calories vs target"
        description="Days with no entries are left blank rather than shown as zero."
        empty={loggedDays === 0}
        emptyHint="Log a meal to see this."
      >
        <BarChart data={data.calorieSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={16} />
          <YAxis {...AXIS} width={38} />
          <Tooltip
            cursor={{ fill: 'var(--bg-subtle)' }}
            content={<TooltipBox unit="kcal" />}
          />
          <ReferenceLine
            y={target}
            stroke="var(--fg-muted)"
            strokeDasharray="4 4"
            label={{ value: 'target', position: 'right', fontSize: 10, fill: 'var(--fg-subtle)' }}
          />
          <Bar dataKey="kcal" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ChartCard>

      <ChartCard
        title="Weight over time"
        empty={data.weightSeries.length < 2}
        emptyHint="Update your weight at least twice to see a trend."
      >
        <LineChart data={data.weightSeries} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={16} />
          <YAxis domain={['dataMin - 1.5', 'dataMax + 1.5']} {...AXIS} width={38} />
          <Tooltip content={<TooltipBox unit="kg" />} />
          <Line
            type="monotone"
            dataKey="weightKg"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartCard>

      <ChartCard
        title="Workouts per week"
        empty={data.workoutsPerWeek.length === 0}
        emptyHint="Complete a workout to see this."
      >
        <BarChart data={data.workoutsPerWeek} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="week" tickFormatter={shortDate} {...AXIS} minTickGap={16} />
          <YAxis allowDecimals={false} {...AXIS} width={38} />
          <Tooltip cursor={{ fill: 'var(--bg-subtle)' }} content={<TooltipBox unit="workouts" />} />
          <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ChartCard>
    </div>
  )
}
