export interface Notification {
  id: string
  created_at: string
  notification_type: string
  title: string
  message: string | null
  link: string | null
  read: boolean
  read_at: string | null
  actor_email: string | null
  database_slug: string | null
  resource_type: string | null
  resource_id: string | null
}

export interface NotificationChannel {
  in_app: boolean
  email: boolean
}

export interface NotificationPreferences {
  email_enabled: boolean
  team_invites: NotificationChannel
  database_changes: NotificationChannel
  entry_modifications: NotificationChannel
  field_changes: NotificationChannel
  weekly_digest: boolean
}
