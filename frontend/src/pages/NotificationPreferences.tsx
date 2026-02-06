import { useState, useEffect } from 'react'
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../hooks/useNotifications'
import type { NotificationPreferences as NotifPrefs } from '../types/notifications'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'

const CATEGORIES = [
  { key: 'team_invites', label: 'Team Invites', description: 'Invitations to join teams and role changes' },
  { key: 'database_changes', label: 'Database Changes', description: 'When databases are created, updated, or deleted' },
  { key: 'field_changes', label: 'Field Changes', description: 'When fields are created, updated, or deleted' },
  { key: 'entry_modifications', label: 'Entry Modifications', description: 'When entries are created, updated, or deleted' },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

export default function NotificationPreferences() {
  const { data: prefs, isLoading } = useNotificationPreferences()
  const updatePrefs = useUpdateNotificationPreferences()
  const [localPrefs, setLocalPrefs] = useState<NotifPrefs | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (prefs) {
      setLocalPrefs(prefs)
    }
  }, [prefs])

  if (isLoading || !localPrefs) return <Loading />

  const handleToggle = (category: CategoryKey, channel: 'in_app' | 'email', value: boolean) => {
    setLocalPrefs(prev => {
      if (!prev) return prev
      return {
        ...prev,
        [category]: {
          ...prev[category],
          [channel]: value,
        },
      }
    })
    setSaved(false)
  }

  const handleSave = () => {
    if (!localPrefs) return
    updatePrefs.mutate(localPrefs, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      },
    })
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Notification Settings</h1>

      {/* Global email toggle */}
      <div className="bg-dark-700 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Email Notifications</h3>
            <p className="text-xs text-dark-100 mt-0.5">Master toggle for all email notifications</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localPrefs.email_enabled}
              onChange={e => {
                setLocalPrefs(prev => prev ? { ...prev, email_enabled: e.target.checked } : prev)
                setSaved(false)
              }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-dark-500 peer-focus:ring-2 peer-focus:ring-accent/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
          </label>
        </div>
      </div>

      {/* Per-category settings */}
      <div className="bg-dark-700 rounded-lg overflow-hidden mb-6">
        <div className="grid grid-cols-[1fr,80px,80px] gap-2 px-4 py-3 border-b border-dark-400">
          <div className="text-xs font-medium text-dark-100 uppercase">Category</div>
          <div className="text-xs font-medium text-dark-100 uppercase text-center">In-App</div>
          <div className="text-xs font-medium text-dark-100 uppercase text-center">Email</div>
        </div>

        {CATEGORIES.map(category => (
          <div key={category.key} className="grid grid-cols-[1fr,80px,80px] gap-2 px-4 py-3 border-b border-dark-600 items-center">
            <div>
              <div className="text-sm text-white">{category.label}</div>
              <div className="text-xs text-dark-100">{category.description}</div>
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={localPrefs[category.key].in_app}
                onChange={e => handleToggle(category.key, 'in_app', e.target.checked)}
                className="h-4 w-4 rounded border-dark-400 bg-dark-600 text-accent focus:ring-accent/50"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={localPrefs[category.key].email}
                onChange={e => handleToggle(category.key, 'email', e.target.checked)}
                disabled={!localPrefs.email_enabled}
                className="h-4 w-4 rounded border-dark-400 bg-dark-600 text-accent focus:ring-accent/50 disabled:opacity-50"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Weekly digest */}
      <div className="bg-dark-700 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Weekly Digest</h3>
            <p className="text-xs text-dark-100 mt-0.5">Receive a weekly summary of activity</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localPrefs.weekly_digest}
              onChange={e => {
                setLocalPrefs(prev => prev ? { ...prev, weekly_digest: e.target.checked } : prev)
                setSaved(false)
              }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-dark-500 peer-focus:ring-2 peer-focus:ring-accent/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} loading={updatePrefs.isPending}>
          Save Preferences
        </Button>
        {saved && (
          <span className="text-sm text-green-400">Preferences saved.</span>
        )}
      </div>
    </div>
  )
}
