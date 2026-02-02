import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getDatabase, updateDatabase, deleteDatabase } from '../api/databases'
import { getFields, createField, updateField, deleteField, previewTypeChange, reorderFields } from '../api/fields'
import type { TypeChangeAnalysis } from '../api/fields'
import { getEntries, createEntry, updateEntry, deleteEntry } from '../api/entries'
import { getInsights, askQuestion } from '../api/ai'
import { getAuditLogs, ACTION_LABELS, RESOURCE_TYPE_LABELS, type AuditLog } from '../api/audit'
import { Button, Modal, Input, Select, Table, Loading } from '../components/ui'
import type { Field, Entry, FieldType } from '../types'

const FIELD_TYPE_OPTIONS = [
  { value: 'STR', label: 'String' },
  { value: 'INT', label: 'Integer' },
  { value: 'DEC', label: 'Decimal' },
  { value: 'BOOL', label: 'Boolean' },
  { value: 'DATE', label: 'Date' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'URL', label: 'URL' },
  { value: 'DICT', label: 'Dictionary' },
  { value: 'LIST', label: 'List' },
]

type SQLDialect = 'mysql' | 'postgresql' | 'sqlite' | 'sqlserver' | 'prisma'

const SQL_DIALECT_OPTIONS = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'prisma', label: 'Prisma Schema' },
]

// Type mappings for each dialect
const TYPE_MAPS: Record<SQLDialect, Record<FieldType, string>> = {
  mysql: {
    STR: 'VARCHAR(255)',
    INT: 'INT',
    DEC: 'DECIMAL(10, 2)',
    BOOL: 'TINYINT(1)',
    DATE: 'DATE',
    EMAIL: 'VARCHAR(255)',
    URL: 'VARCHAR(2048)',
    DICT: 'JSON',
    LIST: 'JSON',
  },
  postgresql: {
    STR: 'VARCHAR(255)',
    INT: 'INTEGER',
    DEC: 'DECIMAL(10, 2)',
    BOOL: 'BOOLEAN',
    DATE: 'DATE',
    EMAIL: 'VARCHAR(255)',
    URL: 'VARCHAR(2048)',
    DICT: 'JSONB',
    LIST: 'JSONB',
  },
  sqlite: {
    STR: 'TEXT',
    INT: 'INTEGER',
    DEC: 'REAL',
    BOOL: 'INTEGER',
    DATE: 'TEXT',
    EMAIL: 'TEXT',
    URL: 'TEXT',
    DICT: 'TEXT',
    LIST: 'TEXT',
  },
  sqlserver: {
    STR: 'NVARCHAR(255)',
    INT: 'INT',
    DEC: 'DECIMAL(10, 2)',
    BOOL: 'BIT',
    DATE: 'DATE',
    EMAIL: 'NVARCHAR(255)',
    URL: 'NVARCHAR(2048)',
    DICT: 'NVARCHAR(MAX)',
    LIST: 'NVARCHAR(MAX)',
  },
  prisma: {
    STR: 'String',
    INT: 'Int',
    DEC: 'Decimal',
    BOOL: 'Boolean',
    DATE: 'DateTime',
    EMAIL: 'String',
    URL: 'String',
    DICT: 'Json',
    LIST: 'Json',
  },
}

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
}

function toPascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

function generateSQLQuery(tableName: string, fields: Field[], dialect: SQLDialect): string {
  const sortedFields = [...fields].sort((a, b) => a.order - b.order)
  const typeMap = TYPE_MAPS[dialect]

  if (dialect === 'prisma') {
    return generatePrismaSchema(tableName, sortedFields, typeMap)
  }

  const sanitizedName = sanitizeName(tableName)

  switch (dialect) {
    case 'mysql':
      return generateMySQLQuery(sanitizedName, sortedFields, typeMap)
    case 'postgresql':
      return generatePostgreSQLQuery(sanitizedName, sortedFields, typeMap)
    case 'sqlite':
      return generateSQLiteQuery(sanitizedName, sortedFields, typeMap)
    case 'sqlserver':
      return generateSQLServerQuery(sanitizedName, sortedFields, typeMap)
    default:
      return ''
  }
}

function generateMySQLQuery(tableName: string, fields: Field[], typeMap: Record<FieldType, string>): string {
  const columnDefs = fields.map((field) => {
    const colName = sanitizeName(field.name)
    const mysqlType = typeMap[field.field_type]
    const nullable = field.required ? 'NOT NULL' : 'NULL'
    return `  \`${colName}\` ${mysqlType} ${nullable}`
  })

  return `CREATE TABLE \`${tableName}\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
${columnDefs.join(',\n')},
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);`
}

function generatePostgreSQLQuery(tableName: string, fields: Field[], typeMap: Record<FieldType, string>): string {
  const columnDefs = fields.map((field) => {
    const colName = sanitizeName(field.name)
    const pgType = typeMap[field.field_type]
    const nullable = field.required ? 'NOT NULL' : ''
    return `  "${colName}" ${pgType}${nullable ? ' ' + nullable : ''}`
  })

  return `CREATE TABLE "${tableName}" (
  "id" SERIAL PRIMARY KEY,
${columnDefs.join(',\n')},
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_${tableName}_updated_at
  BEFORE UPDATE ON "${tableName}"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();`
}

function generateSQLiteQuery(tableName: string, fields: Field[], typeMap: Record<FieldType, string>): string {
  const columnDefs = fields.map((field) => {
    const colName = sanitizeName(field.name)
    const sqliteType = typeMap[field.field_type]
    const nullable = field.required ? 'NOT NULL' : ''
    return `  "${colName}" ${sqliteType}${nullable ? ' ' + nullable : ''}`
  })

  return `CREATE TABLE "${tableName}" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
${columnDefs.join(',\n')},
  "created_at" TEXT DEFAULT (datetime('now')),
  "updated_at" TEXT DEFAULT (datetime('now'))
);

-- Trigger for updated_at
CREATE TRIGGER update_${tableName}_updated_at
  AFTER UPDATE ON "${tableName}"
  FOR EACH ROW
BEGIN
  UPDATE "${tableName}" SET updated_at = datetime('now') WHERE id = NEW.id;
END;`
}

function generateSQLServerQuery(tableName: string, fields: Field[], typeMap: Record<FieldType, string>): string {
  const columnDefs = fields.map((field) => {
    const colName = sanitizeName(field.name)
    const ssType = typeMap[field.field_type]
    const nullable = field.required ? 'NOT NULL' : 'NULL'
    return `  [${colName}] ${ssType} ${nullable}`
  })

  return `CREATE TABLE [dbo].[${tableName}] (
  [id] INT IDENTITY(1,1) PRIMARY KEY,
${columnDefs.join(',\n')},
  [created_at] DATETIME2 DEFAULT GETUTCDATE(),
  [updated_at] DATETIME2 DEFAULT GETUTCDATE()
);
GO

-- Trigger for updated_at
CREATE TRIGGER [dbo].[TR_${tableName}_UpdatedAt]
ON [dbo].[${tableName}]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE [dbo].[${tableName}]
  SET [updated_at] = GETUTCDATE()
  FROM [dbo].[${tableName}] t
  INNER JOIN inserted i ON t.id = i.id;
END;
GO`
}

function generatePrismaSchema(tableName: string, fields: Field[], typeMap: Record<FieldType, string>): string {
  const modelName = toPascalCase(tableName)

  const fieldDefs = fields.map((field) => {
    const fieldName = sanitizeName(field.name)
    const prismaType = typeMap[field.field_type]
    const optional = field.required ? '' : '?'
    return `  ${fieldName} ${prismaType}${optional}`
  })

  return `model ${modelName} {
  id        Int      @id @default(autoincrement())
${fieldDefs.join('\n')}
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("${sanitizeName(tableName)}")
}`
}

function generateCSV(fields: Field[], entries: Entry[]): string {
  const sortedFields = [...fields].sort((a, b) => a.order - b.order)

  // Escape CSV value
  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Header row: field names + Created, Updated
  const header = [...sortedFields.map((f) => escapeCSV(f.name)), 'Created', 'Updated'].join(',')

  // Data rows
  const rows = entries.map((entry) =>
    [
      ...sortedFields.map((f) => escapeCSV(entry.values[f.name])),
      escapeCSV(entry.created_at),
      escapeCSV(entry.updated_at),
    ].join(',')
  )

  return [header, ...rows].join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

interface SortableFieldItemProps {
  field: Field
  onEdit: (field: Field) => void
  onDelete: (field: Field) => void
}

function SortableFieldItem({ field, onEdit, onDelete }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex justify-between items-center p-3 bg-dark-600 rounded"
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-dark-200 hover:text-white p-1"
          title="Drag to reorder"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </button>
        <div>
          <span className="font-medium text-white">{field.name}</span>
          <span className="ml-2 text-sm text-dark-100">({field.field_type})</span>
          {field.required && <span className="ml-2 text-xs text-red-400">required</span>}
        </div>
      </div>
      <div className="space-x-2">
        <button
          onClick={() => onEdit(field)}
          className="text-accent hover:text-accent-light text-sm"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(field)}
          className="text-red-400 hover:text-red-300 text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export default function DatabaseDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  // Field modal state
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)
  const [fieldForm, setFieldForm] = useState({ name: '', field_type: 'STR' as FieldType, required: false })

  // Entry modal state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [entryValues, setEntryValues] = useState<Record<string, string>>({})

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'field' | 'entry'; item: Field | Entry } | null>(null)

  // Database edit modal state
  const [isDbModalOpen, setIsDbModalOpen] = useState(false)
  const [dbForm, setDbForm] = useState({ title: '', description: '' })

  // Type change warning modal state
  const [typeChangeWarning, setTypeChangeWarning] = useState<{
    analysis: TypeChangeAnalysis
    pendingUpdate: { name: string; field_type: FieldType; required: boolean }
  } | null>(null)

  // SQL modal state
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false)
  const [sqlDialect, setSqlDialect] = useState<SQLDialect>('mysql')

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  // AI state
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false)
  const [aiTab, setAiTab] = useState<'insights' | 'ask'>('insights')
  const [insights, setInsights] = useState<string | null>(null)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Audit log state
  const [isAuditPanelOpen, setIsAuditPanelOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPages, setAuditPages] = useState(0)
  const [isLoadingAudit, setIsLoadingAudit] = useState(false)
  const [auditFilter, setAuditFilter] = useState<string>('')
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null)

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

  const { data: entriesData } = useQuery({
    queryKey: ['entries', slug, page],
    queryFn: () => getEntries(slug!, page),
    enabled: !!slug,
  })

  // Mutations
  const createFieldMutation = useMutation({
    mutationFn: (data: { name: string; field_type: FieldType; required: boolean }) =>
      createField(slug!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', slug] })
      closeFieldModal()
    },
  })

  const updateFieldMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; field_type?: FieldType; required?: boolean; confirm_data_loss?: boolean } }) =>
      updateField(slug!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', slug] })
      queryClient.invalidateQueries({ queryKey: ['entries', slug] })
      closeFieldModal()
      setTypeChangeWarning(null)
    },
  })

  const deleteFieldMutation = useMutation({
    mutationFn: (id: string) => deleteField(slug!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', slug] })
      setDeleteTarget(null)
    },
  })

  const createEntryMutation = useMutation({
    mutationFn: (data: { values: Record<string, unknown> }) => createEntry(slug!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', slug] })
      closeEntryModal()
    },
  })

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { values: Record<string, unknown> } }) =>
      updateEntry(slug!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', slug] })
      closeEntryModal()
    },
  })

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => deleteEntry(slug!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', slug] })
      setDeleteTarget(null)
    },
  })

  const deleteDatabaseMutation = useMutation({
    mutationFn: () => deleteDatabase(slug!),
    onSuccess: () => navigate('/dashboard'),
  })

  const updateDatabaseMutation = useMutation({
    mutationFn: (data: { title?: string; description?: string }) => updateDatabase(slug!, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['database', slug] })
      setIsDbModalOpen(false)
      // Navigate to new slug if it changed
      if (response.database.slug !== slug) {
        navigate(`/databases/${response.database.slug}`, { replace: true })
      }
    },
  })

  const reorderFieldsMutation = useMutation({
    mutationFn: (fieldIds: string[]) => reorderFields(slug!, fieldIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', slug] })
    },
  })

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id)
      const newIndex = fields.findIndex((f) => f.id === over.id)
      const newOrder = arrayMove(fields, oldIndex, newIndex)
      const fieldIds = newOrder.map((f) => f.id)
      reorderFieldsMutation.mutate(fieldIds)
    }
  }

  // Handlers
  const openFieldModal = (field?: Field) => {
    if (field) {
      setEditingField(field)
      setFieldForm({ name: field.name, field_type: field.field_type, required: field.required })
    } else {
      setEditingField(null)
      setFieldForm({ name: '', field_type: 'STR', required: false })
    }
    setIsFieldModalOpen(true)
  }

  const closeFieldModal = () => {
    setIsFieldModalOpen(false)
    setEditingField(null)
    setFieldForm({ name: '', field_type: 'STR', required: false })
  }

  const handleFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingField) {
      // Check if type is changing
      if (fieldForm.field_type !== editingField.field_type) {
        try {
          const analysis = await previewTypeChange(slug!, editingField.id, fieldForm.field_type)
          if (analysis.will_lose_data > 0) {
            setTypeChangeWarning({ analysis, pendingUpdate: fieldForm })
            return
          }
        } catch {
          // If preview fails, proceed anyway
        }
      }
      updateFieldMutation.mutate({ id: editingField.id, data: fieldForm })
    } else {
      createFieldMutation.mutate(fieldForm)
    }
  }

  const confirmTypeChange = () => {
    if (editingField && typeChangeWarning) {
      updateFieldMutation.mutate({
        id: editingField.id,
        data: { ...typeChangeWarning.pendingUpdate, confirm_data_loss: true },
      })
      setTypeChangeWarning(null)
    }
  }

  const openEntryModal = (entry?: Entry) => {
    if (entry) {
      setEditingEntry(entry)
      const values: Record<string, string> = {}
      fields.forEach((f) => {
        values[f.name] = String(entry.values[f.name] ?? '')
      })
      setEntryValues(values)
    } else {
      setEditingEntry(null)
      const values: Record<string, string> = {}
      fields.forEach((f) => {
        values[f.name] = ''
      })
      setEntryValues(values)
    }
    setIsEntryModalOpen(true)
  }

  const closeEntryModal = () => {
    setIsEntryModalOpen(false)
    setEditingEntry(null)
    setEntryValues({})
  }

  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const values: Record<string, unknown> = {}
    fields.forEach((f) => {
      const val = entryValues[f.name]
      if (f.field_type === 'INT') values[f.name] = parseInt(val) || 0
      else if (f.field_type === 'DEC') values[f.name] = parseFloat(val) || 0
      else if (f.field_type === 'BOOL') values[f.name] = val === 'true'
      else values[f.name] = val
    })

    if (editingEntry) {
      updateEntryMutation.mutate({ id: editingEntry.id, data: { values } })
    } else {
      createEntryMutation.mutate({ values })
    }
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'field') {
      deleteFieldMutation.mutate(deleteTarget.item.id)
    } else {
      deleteEntryMutation.mutate(deleteTarget.item.id)
    }
  }

  const openDbModal = () => {
    setDbForm({ title: database?.title || '', description: database?.description || '' })
    setIsDbModalOpen(true)
  }

  const handleDbSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateDatabaseMutation.mutate(dbForm)
  }

  const handleExportCSV = async () => {
    if (!slug || fields.length === 0) return

    setIsExporting(true)
    try {
      // Fetch all entries (up to 10000)
      const allEntriesData = await getEntries(slug, 1, 10000)
      const csv = generateCSV(fields, allEntriesData.entries)
      const filename = `${database?.title || 'export'}-${new Date().toISOString().split('T')[0]}.csv`
      downloadCSV(csv, filename)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopySQL = () => {
    if (!database) return
    const sql = generateSQLQuery(database.title, fields, sqlDialect)
    navigator.clipboard.writeText(sql)
  }

  const handleGetInsights = async () => {
    if (!slug) return
    setIsLoadingInsights(true)
    setAiError(null)
    try {
      const response = await getInsights(slug)
      setInsights(response.insights)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      setAiError(err.response?.data?.error || 'Failed to get insights')
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const handleAskQuestion = async () => {
    if (!slug || !aiQuestion.trim()) return
    setIsLoadingAnswer(true)
    setAiError(null)
    try {
      const response = await askQuestion(slug, aiQuestion)
      setAiAnswer(response.answer)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      setAiError(err.response?.data?.error || 'Failed to get answer')
    } finally {
      setIsLoadingAnswer(false)
    }
  }

  const loadAuditLogs = async (pageNum = 1) => {
    if (!slug) return
    setIsLoadingAudit(true)
    try {
      const filters = auditFilter ? { action: auditFilter } : undefined
      const response = await getAuditLogs(slug, pageNum, 20, filters)
      setAuditLogs(response.audit_logs)
      setAuditPage(response.pagination.page)
      setAuditTotal(response.pagination.total)
      setAuditPages(response.pagination.pages)
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    } finally {
      setIsLoadingAudit(false)
    }
  }

  const handleExportAuditLogs = async () => {
    if (!slug) return
    const url = `/api/v1/databases/${slug}/audit-logs/export`

    // Use apiClient to make an authenticated request
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
      })
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${slug}-audit-log.csv`
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Failed to export audit logs:', error)
    }
  }

  const formatAuditDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

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

  const entries = entriesData?.entries ?? []
  const pagination = entriesData?.pagination

  const formatEntryDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  }

  const entryColumns = [
    ...fields.map((f) => ({
      key: f.name,
      header: f.name,
      render: (entry: Entry) => String(entry.values[f.name] ?? '-'),
    })),
    {
      key: 'created_at',
      header: 'Created',
      render: (entry: Entry) => formatEntryDate(entry.created_at),
    },
    {
      key: 'updated_at',
      header: 'Updated',
      render: (entry: Entry) => formatEntryDate(entry.updated_at),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (entry: Entry) => (
        <div className="space-x-2">
          <button
            onClick={() => openEntryModal(entry)}
            className="text-accent hover:text-accent-light text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteTarget({ type: 'entry', item: entry })}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{database.title}</h1>
              <button
                onClick={openDbModal}
                className="text-dark-200 hover:text-white transition-colors"
                title="Edit database"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            </div>
            {database.description && (
              <p className="mt-1 text-dark-100">{database.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              disabled={isExporting || fields.length === 0}
            >
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
            <Button variant="secondary" onClick={() => setIsSqlModalOpen(true)} disabled={fields.length === 0}>
              Export Schema
            </Button>
            <Button onClick={() => navigate(`/databases/${slug}/spreadsheet`)}>
              Spreadsheet View
            </Button>
            <Button variant="danger" onClick={() => deleteDatabaseMutation.mutate()}>
              Delete Database
            </Button>
          </div>
        </div>
      </div>

      {/* Fields Section */}
      <div className="bg-dark-700 rounded-lg border border-dark-500 mb-8">
        <div className="px-6 py-4 border-b border-dark-500 flex justify-between items-center">
          <h2 className="text-lg font-medium text-white">Fields</h2>
          <Button size="sm" onClick={() => openFieldModal()}>
            Add Field
          </Button>
        </div>
        <div className="p-6">
          {fields.length === 0 ? (
            <p className="text-dark-100 text-center py-4">No fields defined yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {fields.map((field) => (
                    <SortableFieldItem
                      key={field.id}
                      field={field}
                      onEdit={openFieldModal}
                      onDelete={(f) => setDeleteTarget({ type: 'field', item: f })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="bg-dark-700 rounded-lg border border-dark-500 mb-8">
        <button
          onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-dark-600 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-accent" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <h2 className="text-lg font-medium text-white">AI Assistant</h2>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 text-dark-200 transition-transform ${isAiPanelOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {isAiPanelOpen && (
          <div className="border-t border-dark-500">
            {/* Tabs */}
            <div className="flex border-b border-dark-500">
              <button
                onClick={() => setAiTab('insights')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  aiTab === 'insights'
                    ? 'text-accent border-b-2 border-accent -mb-px'
                    : 'text-dark-100 hover:text-white'
                }`}
              >
                Insights
              </button>
              <button
                onClick={() => setAiTab('ask')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  aiTab === 'ask'
                    ? 'text-accent border-b-2 border-accent -mb-px'
                    : 'text-dark-100 hover:text-white'
                }`}
              >
                Ask Questions
              </button>
            </div>

            <div className="p-6">
              {aiError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-md text-red-400 text-sm">
                  {aiError}
                </div>
              )}

              {aiTab === 'insights' && (
                <div className="space-y-4">
                  <p className="text-sm text-dark-100">
                    Get AI-powered insights about your data, including patterns, quality issues, and suggestions.
                  </p>
                  <Button
                    onClick={handleGetInsights}
                    loading={isLoadingInsights}
                    disabled={fields.length === 0}
                  >
                    {insights ? 'Refresh Insights' : 'Generate Insights'}
                  </Button>
                  {insights && (
                    <div className="mt-4 p-4 bg-dark-800 rounded-lg">
                      <pre className="text-sm text-dark-50 whitespace-pre-wrap font-sans">{insights}</pre>
                    </div>
                  )}
                </div>
              )}

              {aiTab === 'ask' && (
                <div className="space-y-4">
                  <p className="text-sm text-dark-100">
                    Ask questions about your data in natural language.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="e.g., What's the most common value in the status field?"
                      className="flex-1 px-3 py-2 bg-dark-600 border border-dark-400 rounded-md text-white placeholder-dark-200 focus:outline-none focus:ring-2 focus:ring-accent"
                      disabled={fields.length === 0}
                    />
                    <Button
                      onClick={handleAskQuestion}
                      loading={isLoadingAnswer}
                      disabled={fields.length === 0 || !aiQuestion.trim()}
                    >
                      Ask
                    </Button>
                  </div>
                  {aiAnswer && (
                    <div className="mt-4 p-4 bg-dark-800 rounded-lg">
                      <pre className="text-sm text-dark-50 whitespace-pre-wrap font-sans">{aiAnswer}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Audit Log Section */}
      <div className="bg-dark-700 rounded-lg border border-dark-500 mb-8">
        <button
          onClick={() => {
            setIsAuditPanelOpen(!isAuditPanelOpen)
            if (!isAuditPanelOpen && auditLogs.length === 0) {
              loadAuditLogs()
            }
          }}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-dark-600 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-accent" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            <h2 className="text-lg font-medium text-white">Audit Log</h2>
            {auditTotal > 0 && (
              <span className="text-sm text-dark-200">({auditTotal} entries)</span>
            )}
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 text-dark-200 transition-transform ${isAuditPanelOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {isAuditPanelOpen && (
          <div className="border-t border-dark-500 p-6">
            {/* Filter and Export */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <select
                  value={auditFilter}
                  onChange={(e) => {
                    setAuditFilter(e.target.value)
                    setAuditPage(1)
                  }}
                  className="px-3 py-2 bg-dark-600 border border-dark-400 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">All Actions</option>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" onClick={() => loadAuditLogs(1)}>
                  {isLoadingAudit ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
              <Button size="sm" variant="secondary" onClick={handleExportAuditLogs}>
                Export CSV
              </Button>
            </div>

            {/* Audit Log Table */}
            {isLoadingAudit ? (
              <div className="text-center py-8 text-dark-100">Loading audit logs...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-dark-100">No audit logs yet.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-500">
                        <th className="text-left py-2 px-3 text-dark-100 font-medium">Timestamp</th>
                        <th className="text-left py-2 px-3 text-dark-100 font-medium">User</th>
                        <th className="text-left py-2 px-3 text-dark-100 font-medium">Action</th>
                        <th className="text-left py-2 px-3 text-dark-100 font-medium">Resource</th>
                        <th className="text-left py-2 px-3 text-dark-100 font-medium">Details</th>
                        <th className="text-left py-2 px-3 text-dark-100 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-dark-600 hover:bg-dark-600">
                          <td className="py-2 px-3 text-dark-50 whitespace-nowrap">
                            {formatAuditDate(log.created_at)}
                          </td>
                          <td className="py-2 px-3 text-dark-50">{log.user_email}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              log.action.includes('CREATED') ? 'bg-green-900/50 text-green-400' :
                              log.action.includes('UPDATED') ? 'bg-blue-900/50 text-blue-400' :
                              log.action.includes('DELETED') ? 'bg-red-900/50 text-red-400' :
                              'bg-dark-500 text-dark-100'
                            }`}>
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-dark-50">
                            {RESOURCE_TYPE_LABELS[log.resource_type] || log.resource_type}
                            {log.resource_name && `: ${log.resource_name}`}
                          </td>
                          <td className="py-2 px-3 text-dark-200 max-w-xs truncate">
                            {log.details}
                          </td>
                          <td className="py-2 px-3">
                            {(log.changes || log.previous_state || log.new_state) && (
                              <button
                                onClick={() => setSelectedAuditLog(log)}
                                className="text-accent hover:text-accent-light text-xs"
                              >
                                View Changes
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {auditPages > 1 && (
                  <div className="mt-4 flex justify-center items-center gap-4">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={auditPage === 1}
                      onClick={() => loadAuditLogs(auditPage - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-dark-100">
                      Page {auditPage} of {auditPages}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={auditPage === auditPages}
                      onClick={() => loadAuditLogs(auditPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Entries Section */}
      <div className="bg-dark-700 rounded-lg border border-dark-500">
        <div className="px-6 py-4 border-b border-dark-500 flex justify-between items-center">
          <h2 className="text-lg font-medium text-white">Entries</h2>
          <Button size="sm" onClick={() => openEntryModal()} disabled={fields.length === 0}>
            Add Entry
          </Button>
        </div>
        <div className="p-6">
          {fields.length === 0 ? (
            <p className="text-dark-100 text-center py-4">Add fields before creating entries.</p>
          ) : (
            <>
              <Table
                columns={entryColumns}
                data={entries}
                keyExtractor={(e) => e.id}
                emptyMessage="No entries yet."
              />
              {pagination && pagination.pages > 1 && (
                <div className="mt-4 flex justify-center space-x-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="py-2 px-4 text-sm text-dark-100">
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
            </>
          )}
        </div>
      </div>

      {/* Field Modal */}
      <Modal
        isOpen={isFieldModalOpen}
        onClose={closeFieldModal}
        title={editingField ? 'Edit Field' : 'Add Field'}
      >
        <form onSubmit={handleFieldSubmit} className="space-y-4">
          <Input
            label="Field Name"
            value={fieldForm.name}
            onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
            required
          />
          <Select
            label="Field Type"
            value={fieldForm.field_type}
            onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value as FieldType })}
            options={FIELD_TYPE_OPTIONS}
          />
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={fieldForm.required}
              onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })}
              className="rounded border-dark-400 bg-dark-600 text-accent focus:ring-accent"
            />
            <span className="ml-2 text-sm text-dark-100">Required field</span>
          </label>
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeFieldModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createFieldMutation.isPending || updateFieldMutation.isPending}
            >
              {editingField ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Entry Modal */}
      <Modal
        isOpen={isEntryModalOpen}
        onClose={closeEntryModal}
        title={editingEntry ? 'Edit Entry' : 'Add Entry'}
      >
        <form onSubmit={handleEntrySubmit} className="space-y-4">
          {fields.map((field) => (
            <Input
              key={field.id}
              label={`${field.name}${field.required ? ' *' : ''}`}
              value={entryValues[field.name] || ''}
              onChange={(e) => setEntryValues({ ...entryValues, [field.name]: e.target.value })}
              required={field.required}
              type={field.field_type === 'INT' || field.field_type === 'DEC' ? 'number' : 'text'}
            />
          ))}
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeEntryModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createEntryMutation.isPending || updateEntryMutation.isPending}
            >
              {editingEntry ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.type === 'field' ? 'Field' : 'Entry'}`}
      >
        <p className="text-sm text-dark-100 mb-4">
          Are you sure you want to delete this {deleteTarget?.type}? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleteFieldMutation.isPending || deleteEntryMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>

      {/* Database Edit Modal */}
      <Modal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        title="Edit Database"
      >
        <form onSubmit={handleDbSubmit} className="space-y-4">
          <Input
            label="Database Name"
            value={dbForm.title}
            onChange={(e) => setDbForm({ ...dbForm, title: e.target.value })}
            required
          />
          <Input
            label="Description"
            value={dbForm.description}
            onChange={(e) => setDbForm({ ...dbForm, description: e.target.value })}
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsDbModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateDatabaseMutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Type Change Warning Modal */}
      <Modal
        isOpen={!!typeChangeWarning}
        onClose={() => setTypeChangeWarning(null)}
        title="Data Loss Warning"
      >
        <div className="space-y-4">
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-md p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-400">
                  This type change will cause data loss
                </h3>
              </div>
            </div>
          </div>

          {typeChangeWarning && (
            <div className="text-sm text-dark-100 space-y-2">
              <p>
                <strong className="text-white">{typeChangeWarning.analysis.will_lose_data}</strong> of{' '}
                <strong className="text-white">{typeChangeWarning.analysis.entries_with_value}</strong> entries
                with values cannot be converted to the new type.
              </p>
              {typeChangeWarning.analysis.affected_entries.length > 0 && (
                <div>
                  <p className="font-medium mb-1 text-white">Affected values:</p>
                  <ul className="list-disc list-inside bg-dark-600 rounded p-2 max-h-32 overflow-y-auto">
                    {typeChangeWarning.analysis.affected_entries.map((entry, i) => (
                      <li key={i} className="truncate">
                        {entry.current_value}
                      </li>
                    ))}
                  </ul>
                  {typeChangeWarning.analysis.will_lose_data > 10 && (
                    <p className="text-xs text-dark-200 mt-1">
                      ...and {typeChangeWarning.analysis.will_lose_data - 10} more
                    </p>
                  )}
                </div>
              )}
              <p className="text-red-400 font-medium">
                These values will be cleared if you proceed.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="secondary" onClick={() => setTypeChangeWarning(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmTypeChange}
              loading={updateFieldMutation.isPending}
            >
              Proceed Anyway
            </Button>
          </div>
        </div>
      </Modal>

      {/* SQL Query Modal */}
      <Modal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
        title="Database Schema Export"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-2">
              Database Technology
            </label>
            <select
              value={sqlDialect}
              onChange={(e) => setSqlDialect(e.target.value as SQLDialect)}
              className="w-full px-3 py-2 bg-dark-600 border border-dark-400 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {SQL_DIALECT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-dark-100">
            {sqlDialect === 'prisma'
              ? 'Add this model to your Prisma schema file.'
              : `Use this query to create a ${SQL_DIALECT_OPTIONS.find((o) => o.value === sqlDialect)?.label} table with the same schema as your database.`}
          </p>
          <div className="bg-dark-800 rounded-lg p-4 overflow-x-auto max-h-96">
            <pre className="text-sm text-green-400 font-mono whitespace-pre">
              {database ? generateSQLQuery(database.title, fields, sqlDialect) : ''}
            </pre>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="secondary" onClick={() => setIsSqlModalOpen(false)}>
              Close
            </Button>
            <Button onClick={handleCopySQL}>
              Copy to Clipboard
            </Button>
          </div>
        </div>
      </Modal>

      {/* Audit Log Details Modal */}
      <Modal
        isOpen={!!selectedAuditLog}
        onClose={() => setSelectedAuditLog(null)}
        title="Audit Log Details"
      >
        {selectedAuditLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-dark-200">Timestamp:</span>
                <p className="text-white">{formatAuditDate(selectedAuditLog.created_at)}</p>
              </div>
              <div>
                <span className="text-dark-200">User:</span>
                <p className="text-white">{selectedAuditLog.user_email}</p>
              </div>
              <div>
                <span className="text-dark-200">Action:</span>
                <p className="text-white">{ACTION_LABELS[selectedAuditLog.action] || selectedAuditLog.action}</p>
              </div>
              <div>
                <span className="text-dark-200">Resource:</span>
                <p className="text-white">
                  {RESOURCE_TYPE_LABELS[selectedAuditLog.resource_type] || selectedAuditLog.resource_type}
                  {selectedAuditLog.resource_name && `: ${selectedAuditLog.resource_name}`}
                </p>
              </div>
            </div>

            {selectedAuditLog.details && (
              <div>
                <span className="text-dark-200 text-sm">Details:</span>
                <p className="text-white text-sm mt-1">{selectedAuditLog.details}</p>
              </div>
            )}

            {selectedAuditLog.changes && Object.keys(selectedAuditLog.changes).length > 0 && (
              <div>
                <span className="text-dark-200 text-sm">Changes:</span>
                <div className="mt-2 space-y-2">
                  {Object.entries(selectedAuditLog.changes).map(([key, value]) => (
                    <div key={key} className="bg-dark-800 rounded p-3 text-sm">
                      <span className="font-medium text-white">{key}</span>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-dark-200 text-xs">Previous:</span>
                          <pre className="text-red-400 text-xs mt-1 whitespace-pre-wrap break-all">
                            {JSON.stringify(value.from, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <span className="text-dark-200 text-xs">New:</span>
                          <pre className="text-green-400 text-xs mt-1 whitespace-pre-wrap break-all">
                            {JSON.stringify(value.to, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedAuditLog.previous_state && !selectedAuditLog.changes && (
              <div>
                <span className="text-dark-200 text-sm">Previous State:</span>
                <div className="bg-dark-800 rounded p-3 mt-2">
                  <pre className="text-xs text-dark-50 whitespace-pre-wrap break-all">
                    {JSON.stringify(selectedAuditLog.previous_state, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {selectedAuditLog.new_state && !selectedAuditLog.changes && (
              <div>
                <span className="text-dark-200 text-sm">New State:</span>
                <div className="bg-dark-800 rounded p-3 mt-2">
                  <pre className="text-xs text-dark-50 whitespace-pre-wrap break-all">
                    {JSON.stringify(selectedAuditLog.new_state, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={() => setSelectedAuditLog(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
