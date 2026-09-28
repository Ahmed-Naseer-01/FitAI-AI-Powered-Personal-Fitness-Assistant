'use client'

import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { DashboardData } from '@/lib/stats'

function Panel({
  title, empty, hint, children,
}: {
  title: string
  empty: boolean
  hint: string
  children: React.ReactElement
}) {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {empty ? (
        <p className="py-10 text-center text-sm text-gray-400">{hint}</p>
      ) : (
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

const shortDate = (d: string) => d.slice(5)

export default function Charts({ data, target }: { data: DashboardData; target: number }) {
  const loggedDays = data.calorieSeries.filter((p) => p.kcal !== null).length

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Calories consumed vs target"
        empty={loggedDays === 0}
        hint="Log a meal to see this."
      >
        <BarChart data={data.calorieSeries}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <ReferenceLine y={target} stroke="#111827" strokeDasharray="4 4" />
          {/* Null days are left as gaps on purpose — a zero bar would claim
              the user ate nothing rather than that no data exists. */}
          <Bar dataKey="kcal" fill="#111827" radius={[3, 3, 0, 0]} />
        </BarChart>
      </Panel>

      <Panel
        title="Weight over time"
        empty={data.weightSeries.length < 2}
        hint="Update your weight at least twice to see a trend."
      >
        <LineChart data={data.weightSeries}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
          <YAxis domain={['dataMin - 2', 'dataMax + 2']} fontSize={11} />
          <Tooltip />
          <Line type="monotone" dataKey="weightKg" stroke="#111827" strokeWidth={2} dot />
        </LineChart>
      </Panel>

      <Panel
        title="Workouts per week"
        empty={data.workoutsPerWeek.length === 0}
        hint="Complete a workout to see this."
      >
        <BarChart data={data.workoutsPerWeek}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tickFormatter={shortDate} fontSize={11} />
          <YAxis allowDecimals={false} fontSize={11} />
          <Tooltip />
          <Bar dataKey="count" fill="#111827" radius={[3, 3, 0, 0]} />
        </BarChart>
      </Panel>
    </div>
  )
}
