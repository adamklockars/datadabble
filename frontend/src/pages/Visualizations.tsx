import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getVisualizations,
  createVisualization,
  updateVisualization,
  deleteVisualization,
  getDatabases,
  getDatabase,
} from '../api'
import { Button, Modal, Input, Select, Loading } from '../components/ui'
import type { Visualization, Database, ChartType } from '../types'

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar chart' },
  { value: 'line', label: 'Line chart' },
  { value: 'pie', label: 'Pie chart' },
]

const AGGREGATION_OPTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
]

/** Entry timestamp fields for x-axis (grouped by day). */
const ENTRY_TIMESTAMP_X_OPTIONS = [
  { value: '__created_at__', label: 'Created at (date)' },
  { value: '__updated_at__', label: 'Updated at (date)' },
]

function xFieldLabel(xField: string): string {
  const found = ENTRY_TIMESTAMP_X_OPTIONS.find((o) => o.value === xField)
  return found ? found.label : xField
}

export default function Visualizations() {
  const queryClient = useQueryClient()
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingViz, setEditingViz] = useState<Visualization | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedViz, setSelectedViz] = useState<Visualization | null>(null)
  const [title, setTitle] = useState('')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [databaseSlugs, setDatabaseSlugs] = useState<string[]>([])
  const [xField, setXField] = useState('')
  const [yField, setYField] = useState('')
  const [aggregation, setAggregation] = useState<'count' | 'sum'>('count')

  const { data: visualizations = [], isLoading, error } = useQuery({
    queryKey: ['visualizations'],
    queryFn: getVisualizations,
  })

  const { data: databases = [] } = useQuery({
    queryKey: ['databases'],
    queryFn: getDatabases,
  })

  const { data: firstDb } = useQuery({
    queryKey: ['database', databaseSlugs[0]],
    queryFn: () => getDatabase(databaseSlugs[0]),
    enabled: databaseSlugs.length > 0 && !!databaseSlugs[0],
  })

  const createMutation = useMutation({
    mutationFn: createVisualization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visualizations'] })
      setIsFormModalOpen(false)
      setEditingViz(null)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateVisualization>[1] }) =>
      updateVisualization(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['visualizations'] })
      queryClient.invalidateQueries({ queryKey: ['visualization', id] })
      queryClient.invalidateQueries({ queryKey: ['visualizationData', id] })
      setIsFormModalOpen(false)
      setEditingViz(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteVisualization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visualizations'] })
      setIsDeleteModalOpen(false)
      setSelectedViz(null)
    },
  })

  function resetForm() {
    setTitle('')
    setChartType('bar')
    setDatabaseSlugs([])
    setXField('')
    setYField('')
    setAggregation('count')
  }

  const toggleDatabase = (slug: string) => {
    setDatabaseSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  function openCreateModal() {
    setEditingViz(null)
    resetForm()
    setIsFormModalOpen(true)
  }

  function openEditModal(viz: Visualization) {
    setEditingViz(viz)
    setTitle(viz.title)
    setChartType(viz.chart_type)
    setDatabaseSlugs([...viz.database_slugs])
    setXField(viz.x_field)
    setYField(viz.y_field ?? '')
    setAggregation(viz.aggregation)
    setIsFormModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!databaseSlugs.length || !xField.trim()) return
    const payload = {
      title: title.trim(),
      chart_type: chartType,
      database_slugs: databaseSlugs,
      x_field: xField.trim(),
      y_field: aggregation === 'sum' ? yField.trim() || undefined : undefined,
      aggregation,
    }
    if (editingViz) {
      updateMutation.mutate({ id: editingViz.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = () => {
    if (selectedViz) deleteMutation.mutate(selectedViz.id)
  }

  const fieldOptions = (firstDb?.fields || []).map((f) => ({ value: f.name, label: `${f.name} (${f.field_type})` }))
  const categoryFieldOptions = [...ENTRY_TIMESTAMP_X_OPTIONS, ...fieldOptions]

  const [searchParams, setSearchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  useEffect(() => {
    if (!editId || visualizations.length === 0) return
    const viz = visualizations.find((v) => v.id === editId)
    if (viz) {
      setEditingViz(viz)
      setTitle(viz.title)
      setChartType(viz.chart_type)
      setDatabaseSlugs([...viz.database_slugs])
      setXField(viz.x_field)
      setYField(viz.y_field ?? '')
      setAggregation(viz.aggregation)
      setIsFormModalOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [editId, visualizations, setSearchParams])

  if (isLoading) {
    return <Loading message="Loading visualizations..." />
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        Failed to load visualizations. Please try again.
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white">Data Visualizations</h1>
        <Button onClick={openCreateModal}>
          Create Visualization
        </Button>
      </div>

      <p className="text-dark-100 mb-6">
        Create charts from one database or combine data across multiple databases. Choose a category field (x-axis) and optional value field to aggregate.
      </p>

      {visualizations.length === 0 ? (
        <div className="text-center py-12 bg-dark-700 rounded-lg border-2 border-dashed border-dark-400">
          <svg className="mx-auto h-12 w-12 text-dark-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-white">No visualizations yet</h3>
          <p className="mt-1 text-sm text-dark-100">Create your first chart from a database or across databases.</p>
          <div className="mt-6">
            <Button onClick={openCreateModal}>
              Create Visualization
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visualizations.map((viz) => (
            <div
              key={viz.id}
              className="bg-dark-700 rounded-lg p-6 hover:bg-dark-600 transition-colors border border-dark-500"
            >
              <Link to={`/visualizations/${viz.id}`}>
                <h3 className="text-lg font-medium text-white hover:text-accent transition-colors">
                  {viz.title}
                </h3>
              </Link>
              <p className="mt-1 text-sm text-dark-200 capitalize">{viz.chart_type} chart</p>
              <p className="mt-1 text-xs text-dark-100">
                {viz.database_slugs.length === 1
                  ? '1 database'
                  : `${viz.database_slugs.length} databases`}
                {' · '}
                {xFieldLabel(viz.x_field)}
                {viz.y_field ? ` / ${viz.y_field} (${viz.aggregation})` : ` (${viz.aggregation})`}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link to={`/visualizations/${viz.id}`}>
                  <Button variant="secondary" size="sm">
                    View chart
                  </Button>
                </Link>
                <Button variant="secondary" size="sm" onClick={() => openEditModal(viz)}>
                  Edit
                </Button>
                <button
                  onClick={() => {
                    setSelectedViz(viz)
                    setIsDeleteModalOpen(true)
                  }}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => { setIsFormModalOpen(false); setEditingViz(null); resetForm(); }}
        title={editingViz ? 'Edit Visualization' : 'Create Visualization'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Sales by Region"
          />
          <Select
            label="Chart type"
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            options={CHART_TYPE_OPTIONS}
          />
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-2">
              Database(s)
            </label>
            <p className="text-xs text-dark-200 mb-2">
              Select one database or multiple to compare across databases.
            </p>
            <div className="max-h-40 overflow-y-auto rounded-md border border-dark-400 bg-dark-600 p-2 space-y-1">
              {databases.map((db: Database) => (
                <label key={db.id} className="flex items-center gap-2 cursor-pointer hover:bg-dark-500 rounded px-2 py-1">
                  <input
                    type="checkbox"
                    checked={databaseSlugs.includes(db.slug)}
                    onChange={() => toggleDatabase(db.slug)}
                    className="rounded border-dark-400 bg-dark-700 text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-white">{db.title}</span>
                </label>
              ))}
            </div>
            {databaseSlugs.length === 0 && (
              <p className="mt-1 text-xs text-red-400">Select at least one database.</p>
            )}
          </div>
          {databaseSlugs.length > 0 && (
            <>
              <Select
                label="Category field (x-axis / labels)"
                value={xField}
                onChange={(e) => setXField(e.target.value)}
                options={[{ value: '', label: 'Select field...' }, ...categoryFieldOptions]}
                required
              />
              <Select
                label="Aggregation"
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value as 'count' | 'sum')}
                options={AGGREGATION_OPTIONS}
              />
              {aggregation === 'sum' && (
                <Select
                  label="Value field (to sum)"
                  value={yField}
                  onChange={(e) => setYField(e.target.value)}
                  options={[{ value: '', label: 'Select field...' }, ...fieldOptions.filter((o) => o.value !== xField)]}
                />
              )}
            </>
          )}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setIsFormModalOpen(false); setEditingViz(null); resetForm(); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={databaseSlugs.length === 0 || !xField.trim() || (aggregation === 'sum' && !yField.trim())}
            >
              {editingViz ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Visualization"
      >
        <p className="text-sm text-dark-100 mb-4">
          Are you sure you want to delete &quot;{selectedViz?.title}&quot;? This cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
