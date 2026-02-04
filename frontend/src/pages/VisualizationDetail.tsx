import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getVisualization, getVisualizationData } from '../api'
import { Button, Loading } from '../components/ui'
import type { ChartDataSeries } from '../types'

const CHART_COLORS = [
  '#1e90ff', // accent
  '#22c55e',
  '#eab308',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#f97316',
]

function buildBarLineData(series: ChartDataSeries[]) {
  const labelMap = new Map<string, Record<string, string | number>>()
  for (const s of series) {
    for (const point of s.data) {
      if (!labelMap.has(point.name)) {
        labelMap.set(point.name, { name: point.name })
      }
      const row = labelMap.get(point.name)!
      row[s.database_title] = point.value
    }
  }
  return Array.from(labelMap.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

export default function VisualizationDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: visualization, isLoading: vizLoading, error: vizError } = useQuery({
    queryKey: ['visualization', id],
    queryFn: () => getVisualization(id!),
    enabled: !!id,
  })
  const { data: chartData, isLoading: dataLoading, error: dataError } = useQuery({
    queryKey: ['visualizationData', id],
    queryFn: () => getVisualizationData(id!),
    enabled: !!id,
  })

  const isLoading = vizLoading || dataLoading
  const error = vizError || dataError

  if (isLoading) {
    return <Loading message="Loading chart..." />
  }

  if (error || !visualization) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">Failed to load visualization.</p>
        <Link to="/visualizations">
          <Button variant="secondary">Back to Visualizations</Button>
        </Link>
      </div>
    )
  }

  if (!chartData?.series?.length) {
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <Link to="/visualizations">
            <Button variant="secondary">← Back</Button>
          </Link>
          <h1 className="text-2xl font-bold text-white">{visualization.title}</h1>
        </div>
        <div className="bg-dark-700 rounded-lg p-12 text-center border border-dark-500">
          <p className="text-dark-100">No data to display. Add entries to the selected database(s) or check field names.</p>
        </div>
      </div>
    )
  }

  const chartType = visualization.chart_type
  const series = chartData.series

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <Link to="/visualizations">
          <Button variant="secondary">← Back</Button>
        </Link>
        <Link to={`/visualizations?edit=${id}`}>
          <Button variant="secondary">Edit</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{visualization.title}</h1>
          <p className="text-sm text-dark-200 capitalize mt-0.5">
            {chartType} · {series.map((s) => s.database_title).join(', ')}
          </p>
        </div>
      </div>

      <div className="bg-dark-700 rounded-lg p-6 border border-dark-500 min-h-[400px]">
        {chartType === 'pie' && series.length === 1 && (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={series[0].data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={140}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {series[0].data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                formatter={(value) => [value, '']}
              />
            </PieChart>
          </ResponsiveContainer>
        )}

        {chartType === 'pie' && series.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {series.map((s) => (
              <div key={s.database_slug}>
                <h3 className="text-sm font-medium text-dark-100 mb-2">{s.database_title}</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={s.data}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {s.data.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      formatter={(value) => [value, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}

        {(chartType === 'bar' || chartType === 'line') && (
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'bar' ? (
              <BarChart data={buildBarLineData(series)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#727272" tick={{ fill: '#a3a3a3' }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#727272" tick={{ fill: '#a3a3a3' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                {series.map((s, i) => (
                  <Bar
                    key={s.database_slug}
                    dataKey={s.database_title}
                    name={s.database_title}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : (
              <LineChart data={buildBarLineData(series)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#727272" tick={{ fill: '#a3a3a3' }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#727272" tick={{ fill: '#a3a3a3' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                {series.map((s, i) => (
                  <Line
                    key={s.database_slug}
                    type="monotone"
                    dataKey={s.database_title}
                    name={s.database_title}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
