import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDatabases, createDatabase, deleteDatabase } from '../api'
import { Button, Modal, Input, Loading } from '../components/ui'
import type { Database } from '../types'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null)
  const [newDatabaseTitle, setNewDatabaseTitle] = useState('')
  const [newDatabaseDescription, setNewDatabaseDescription] = useState('')

  const { data: databases = [], isLoading, error } = useQuery({
    queryKey: ['databases'],
    queryFn: getDatabases,
  })

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description?: string }) => createDatabase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      setIsCreateModalOpen(false)
      setNewDatabaseTitle('')
      setNewDatabaseDescription('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => deleteDatabase(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      setIsDeleteModalOpen(false)
      setSelectedDatabase(null)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      title: newDatabaseTitle,
      description: newDatabaseDescription || undefined,
    })
  }

  const handleDelete = () => {
    if (selectedDatabase) {
      deleteMutation.mutate(selectedDatabase.slug)
    }
  }

  if (isLoading) {
    return <Loading message="Loading databases..." />
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        Failed to load databases. Please try again.
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white">Databases</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          Create Database
        </Button>
      </div>

      {databases.length === 0 ? (
        <div className="text-center py-12 bg-dark-700 rounded-lg border-2 border-dashed border-dark-400">
          <svg className="mx-auto h-12 w-12 text-dark-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-white">No databases</h3>
          <p className="mt-1 text-sm text-dark-100">Get started by creating a new database.</p>
          <div className="mt-6">
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Create Database
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {databases.map((db) => (
            <div key={db.id} className="bg-dark-700 rounded-lg p-6 hover:bg-dark-600 transition-colors border border-dark-500">
              <Link to={`/databases/${db.slug}`}>
                <h3 className="text-lg font-medium text-white hover:text-accent transition-colors">
                  {db.title}
                </h3>
              </Link>
              {db.description && (
                <p className="mt-2 text-sm text-dark-100 line-clamp-2">
                  {db.description}
                </p>
              )}
              <div className="mt-4 flex justify-between items-center text-xs text-dark-200">
                <span>Created {new Date(db.created_at).toLocaleDateString()}</span>
                <button
                  onClick={() => {
                    setSelectedDatabase(db)
                    setIsDeleteModalOpen(true)
                  }}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Database"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Title"
            value={newDatabaseTitle}
            onChange={(e) => setNewDatabaseTitle(e.target.value)}
            required
            placeholder="My Database"
          />
          <Input
            label="Description (optional)"
            value={newDatabaseDescription}
            onChange={(e) => setNewDatabaseDescription(e.target.value)}
            placeholder="A brief description"
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Database"
      >
        <p className="text-sm text-dark-100 mb-4">
          Are you sure you want to delete "{selectedDatabase?.title}"? This action cannot be undone and will delete all fields and entries.
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            variant="secondary"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
