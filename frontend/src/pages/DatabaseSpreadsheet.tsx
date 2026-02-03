import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDatabase } from '../api/databases'
import { getFields } from '../api/fields'
import { getEntries, createEntry, updateEntry, deleteEntry } from '../api/entries'
import { Button, Loading } from '../components/ui'
import EntryFilter from '../components/EntryFilter'
import type { Field, Entry, FieldType } from '../types'

interface CellPosition {
  rowIndex: number
  colIndex: number
}

const MIN_COLUMN_WIDTH = 80
const DEFAULT_COLUMN_WIDTH = 150
const MAX_COLUMN_WIDTH = 500

function formatCellValue(value: unknown, fieldType: FieldType): string {
  if (value === null || value === undefined) return ''
  if (fieldType === 'BOOL') return value ? 'true' : 'false'
  if (fieldType === 'DICT' || fieldType === 'LIST') return JSON.stringify(value)
  return String(value)
}

function parseCellValue(value: string, fieldType: FieldType): unknown {
  if (value === '') return null
  switch (fieldType) {
    case 'INT':
      return parseInt(value) || 0
    case 'DEC':
      return parseFloat(value) || 0
    case 'BOOL':
      return value.toLowerCase() === 'true' || value === '1'
    case 'DICT':
    case 'LIST':
      try {
        return JSON.parse(value)
      } catch {
        return fieldType === 'DICT' ? {} : []
      }
    default:
      return value
  }
}

export default function DatabaseSpreadsheet() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [entryFilter, setEntryFilter] = useState('')
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null)
  const [editValue, setEditValue] = useState('')
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizing, setResizing] = useState<{ fieldId: string; startX: number; startWidth: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)

  // Queries
  const { data: database, isLoading: dbLoading, error: dbError } = useQuery({
    queryKey: ['database', slug],
    queryFn: () => getDatabase(slug!),
    enabled: !!slug,
  })

  const { data: fields = [] } = useQuery({
    queryKey: ['fields', slug],
    queryFn: () => getFields(slug!),
    enabled: !!slug,
  })

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['entries', slug, page, entryFilter],
    queryFn: () => getEntries(slug!, { page, perPage: 100, filter: entryFilter }),
    enabled: !!slug,
  })

  const handleFilterChange = (filter: string) => {
    setEntryFilter(filter)
    setPage(1) // Reset to first page when filter changes
  }

  // Mutations
  const updateEntryMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      updateEntry(slug!, id, { values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', slug] })
    },
  })

  const createEntryMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => createEntry(slug!, { values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', slug] })
    },
  })

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => deleteEntry(slug!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', slug] })
    },
  })

  const entries = entriesData?.entries ?? []
  const pagination = entriesData?.pagination

  // Get column width for a field
  const getColumnWidth = useCallback((fieldId: string) => {
    return columnWidths[fieldId] ?? DEFAULT_COLUMN_WIDTH
  }, [columnWidths])

  // Measure text width for auto-sizing
  const measureTextWidth = useCallback((text: string): number => {
    if (!measureRef.current) return DEFAULT_COLUMN_WIDTH
    measureRef.current.textContent = text
    return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, measureRef.current.offsetWidth + 24))
  }, [])

  // Calculate initial column widths based on content
  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => a.order - b.order)
  }, [fields])

  // Initialize column widths when fields or entries change
  useEffect(() => {
    if (sortedFields.length === 0) return

    const newWidths: Record<string, number> = { ...columnWidths }
    let hasChanges = false

    sortedFields.forEach((field) => {
      if (newWidths[field.id] === undefined) {
        // Calculate initial width based on header and content
        let maxWidth = measureTextWidth(field.name + ' (' + field.field_type + ')')

        entries.slice(0, 50).forEach((entry) => {
          const value = formatCellValue(entry.values[field.name], field.field_type)
          const width = measureTextWidth(value)
          maxWidth = Math.max(maxWidth, width)
        })

        newWidths[field.id] = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, maxWidth))
        hasChanges = true
      }
    })

    if (hasChanges) {
      setColumnWidths(newWidths)
    }
  }, [sortedFields, entries, measureTextWidth, columnWidths])

  // Handle column resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const startWidth = columnWidths[fieldId] ?? DEFAULT_COLUMN_WIDTH
    setResizing({ fieldId, startX: e.clientX, startWidth })
  }, [columnWidths])

  // Handle column resize
  useEffect(() => {
    if (!resizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX
      const newWidth = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, resizing.startWidth + diff))
      setColumnWidths((prev) => ({ ...prev, [resizing.fieldId]: newWidth }))
    }

    const handleMouseUp = () => {
      setResizing(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing])

  // Auto-expand column when entering data
  const autoExpandColumn = useCallback((fieldId: string, value: string) => {
    const measuredWidth = measureTextWidth(value)
    const currentWidth = columnWidths[fieldId] ?? DEFAULT_COLUMN_WIDTH
    if (measuredWidth > currentWidth) {
      setColumnWidths((prev) => ({ ...prev, [fieldId]: measuredWidth }))
    }
  }, [columnWidths, measureTextWidth])

  const startEditing = useCallback((rowIndex: number, colIndex: number, entry: Entry | null) => {
    if (!sortedFields[colIndex]) return
    const field = sortedFields[colIndex]
    const value = entry ? formatCellValue(entry.values[field.name], field.field_type) : ''
    setEditingCell({ rowIndex, colIndex })
    setEditValue(value)
    setSelectedCell({ rowIndex, colIndex })
  }, [sortedFields])

  const saveEdit = useCallback(() => {
    if (!editingCell) return

    const { rowIndex, colIndex } = editingCell
    const field = sortedFields[colIndex]
    if (!field) return

    const isNewRow = rowIndex >= entries.length
    const parsedValue = parseCellValue(editValue, field.field_type)

    // Auto-expand column if content is wider
    autoExpandColumn(field.id, editValue)

    if (isNewRow) {
      const values: Record<string, unknown> = {}
      values[field.name] = parsedValue
      createEntryMutation.mutate(values)
    } else {
      const entry = entries[rowIndex]
      const newValues = { ...entry.values, [field.name]: parsedValue }
      updateEntryMutation.mutate({ id: entry.id, values: newValues })
    }

    setEditingCell(null)
  }, [editingCell, editValue, sortedFields, entries, createEntryMutation, updateEntryMutation, autoExpandColumn])

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell) return

    const { rowIndex, colIndex } = selectedCell
    const maxRow = entries.length
    const maxCol = sortedFields.length - 1

    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault()
        saveEdit()
        if (rowIndex < maxRow) {
          setSelectedCell({ rowIndex: rowIndex + 1, colIndex })
        }
      } else if (e.key === 'Escape') {
        cancelEdit()
      } else if (e.key === 'Tab') {
        e.preventDefault()
        saveEdit()
        if (e.shiftKey) {
          if (colIndex > 0) {
            setSelectedCell({ rowIndex, colIndex: colIndex - 1 })
          } else if (rowIndex > 0) {
            setSelectedCell({ rowIndex: rowIndex - 1, colIndex: maxCol })
          }
        } else {
          if (colIndex < maxCol) {
            setSelectedCell({ rowIndex, colIndex: colIndex + 1 })
          } else if (rowIndex < maxRow) {
            setSelectedCell({ rowIndex: rowIndex + 1, colIndex: 0 })
          }
        }
      }
    } else {
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault()
        const entry = rowIndex < entries.length ? entries[rowIndex] : null
        startEditing(rowIndex, colIndex, entry)
      } else if (e.key === 'ArrowUp' && rowIndex > 0) {
        e.preventDefault()
        setSelectedCell({ rowIndex: rowIndex - 1, colIndex })
      } else if (e.key === 'ArrowDown' && rowIndex < maxRow) {
        e.preventDefault()
        setSelectedCell({ rowIndex: rowIndex + 1, colIndex })
      } else if (e.key === 'ArrowLeft' && colIndex > 0) {
        e.preventDefault()
        setSelectedCell({ rowIndex, colIndex: colIndex - 1 })
      } else if (e.key === 'ArrowRight' && colIndex < maxCol) {
        e.preventDefault()
        setSelectedCell({ rowIndex, colIndex: colIndex + 1 })
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (rowIndex < entries.length) {
          const entry = entries[rowIndex]
          const field = sortedFields[colIndex]
          const newValues = { ...entry.values, [field.name]: null }
          updateEntryMutation.mutate({ id: entry.id, values: newValues })
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const entry = rowIndex < entries.length ? entries[rowIndex] : null
        startEditing(rowIndex, colIndex, entry)
        setEditValue(e.key)
      }
    }
  }, [selectedCell, editingCell, entries, sortedFields, saveEdit, cancelEdit, startEditing, updateEntryMutation])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        if (editingCell) {
          saveEdit()
        }
        setSelectedCell(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCell, saveEdit])

  if (dbLoading) {
    return <Loading message="Loading database..." />
  }

  if (dbError || !database) {
    return (
      <div className="text-center py-12 text-red-400">
        Database not found or failed to load.
      </div>
    )
  }

  if (sortedFields.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-100 mb-4">No fields defined yet. Add fields before using the spreadsheet view.</p>
        <Button onClick={() => navigate(`/databases/${slug}`)}>
          Go to Database Settings
        </Button>
      </div>
    )
  }

  const renderCell = (entry: Entry | null, field: Field, rowIndex: number, colIndex: number) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex
    const isSelected = selectedCell?.rowIndex === rowIndex && selectedCell?.colIndex === colIndex
    const value = entry ? formatCellValue(entry.values[field.name], field.field_type) : ''
    const width = getColumnWidth(field.id)

    return (
      <td
        key={field.id}
        style={{ width, minWidth: width, maxWidth: width }}
        className={`border border-dark-500 px-2 py-1 cursor-cell relative text-white
          ${isSelected ? 'outline outline-2 outline-accent outline-offset-[-2px]' : ''}
          ${!entry ? 'bg-dark-700' : 'bg-dark-600'}
          hover:bg-dark-500`}
        onClick={() => {
          setSelectedCell({ rowIndex, colIndex })
          if (editingCell && (editingCell.rowIndex !== rowIndex || editingCell.colIndex !== colIndex)) {
            saveEdit()
          }
        }}
        onDoubleClick={() => startEditing(rowIndex, colIndex, entry)}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type={field.field_type === 'INT' || field.field_type === 'DEC' ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="w-full h-full border-none outline-none bg-dark-600 text-white p-0 m-0"
            step={field.field_type === 'DEC' ? '0.01' : undefined}
          />
        ) : (
          <span className="block truncate">{value}</span>
        )}
      </td>
    )
  }

  return (
    <div className={`h-full flex flex-col ${resizing ? 'select-none' : ''}`} style={resizing ? { cursor: 'col-resize' } : undefined}>
      {/* Hidden element for measuring text width */}
      <span
        ref={measureRef}
        className="absolute invisible whitespace-nowrap text-sm"
        style={{ font: 'inherit' }}
      />

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={() => navigate(`/databases/${slug}`)}>
            Back to Settings
          </Button>
          <h1 className="text-xl font-semibold text-white">{database.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button
            size="sm"
            onClick={() => {
              const values: Record<string, unknown> = {}
              sortedFields.forEach((f) => {
                values[f.name] = f.default_value ?? null
              })
              createEntryMutation.mutate(values)
            }}
          >
            Add Row
          </Button>
          <div className="text-sm text-dark-100 flex items-center gap-2">
            {(updateEntryMutation.isPending || createEntryMutation.isPending) && (
              <span className="text-accent">Saving...</span>
            )}
            <span>{pagination?.total ?? entries.length} entries</span>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-dark-200 mb-2">
        Enter to edit, Tab to move, Esc to cancel, Arrow keys to navigate, Delete to clear cell
      </div>

      {/* Entry Filter */}
      <div className="mb-4">
        <EntryFilter
          fields={sortedFields}
          onFilterChange={handleFilterChange}
          initialFilter={entryFilter}
        />
      </div>

      {/* Spreadsheet */}
      <div
        ref={tableRef}
        className="flex-1 overflow-auto border border-dark-400 rounded-lg bg-dark-700"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {entriesLoading ? (
          <div className="p-8 text-center text-dark-100">Loading entries...</div>
        ) : (
          <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-dark-800">
                <th className="border border-dark-500 px-2 py-2 text-left text-xs font-semibold text-dark-100 w-12 sticky left-0 bg-dark-800">
                  #
                </th>
                {sortedFields.map((field) => {
                  const width = getColumnWidth(field.id)
                  return (
                    <th
                      key={field.id}
                      style={{ width, minWidth: width, maxWidth: width }}
                      className="border border-dark-500 px-2 py-2 text-left text-xs font-semibold text-dark-100 relative group"
                    >
                      <div className="flex items-center gap-1 pr-2">
                        <span className="text-white truncate">{field.name}</span>
                        <span className="text-dark-200 font-normal flex-shrink-0">({field.field_type})</span>
                        {field.required && <span className="text-red-400 flex-shrink-0">*</span>}
                      </div>
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent group-hover:bg-dark-400"
                        onMouseDown={(e) => handleResizeStart(e, field.id)}
                      />
                    </th>
                  )
                })}
                <th className="border border-dark-500 px-2 py-2 text-center text-xs font-semibold text-dark-100 w-16 bg-dark-800">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, rowIndex) => (
                <tr key={entry.id} className="group">
                  <td className="border border-dark-500 px-2 py-1 text-xs text-dark-200 bg-dark-700 sticky left-0">
                    {(page - 1) * 100 + rowIndex + 1}
                  </td>
                  {sortedFields.map((field, colIndex) => renderCell(entry, field, rowIndex, colIndex))}
                  <td className="border border-dark-500 px-2 py-1 text-center bg-dark-700 w-16">
                    <button
                      onClick={() => {
                        if (confirm('Delete this row?')) {
                          deleteEntryMutation.mutate(entry.id)
                        }
                      }}
                      className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete row"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {/* New row */}
              <tr className="bg-dark-700">
                <td className="border border-dark-500 px-2 py-1 text-xs text-dark-200 sticky left-0 bg-dark-700">
                  +
                </td>
                {sortedFields.map((field, colIndex) => renderCell(null, field, entries.length, colIndex))}
                <td className="border border-dark-500 px-2 py-1 bg-dark-700 w-16"></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex justify-center items-center gap-4">
          <Button
            size="sm"
            variant="secondary"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-dark-100">
            Page {page} of {pagination.pages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page === pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
