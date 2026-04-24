ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS issue_key TEXT,
  ADD COLUMN IF NOT EXISTS event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_event_uniq
  ON public.notifications (user_id, event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_issue_key_idx
  ON public.notifications (issue_key);