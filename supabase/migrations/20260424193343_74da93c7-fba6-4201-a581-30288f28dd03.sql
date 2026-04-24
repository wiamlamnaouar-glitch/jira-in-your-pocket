-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('manager', 'technician');

-- ============================================================
-- 2. TIMESTAMP UPDATE FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. TEAM SEED — pre-approved team to map email → role on signup
-- ============================================================
CREATE TABLE public.team_seed (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  jira_account_id TEXT,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_seed ENABLE ROW LEVEL SECURITY;

-- Seed is read-only via app — no policies needed for clients.
-- Only the trigger (security definer) will read it.

INSERT INTO public.team_seed (email, display_name, jira_account_id, role) VALUES
  ('abir.ratbaoui@uit.ac.ma',     'Abir Ratbaoui',     '712020:af4c1abf', 'manager'),
  ('marwa.harcharras@uit.ac.ma',  'Marwa Harcharras',  '712020:4d221101', 'technician'),
  ('wiam.lamnaouar@uit.ac.ma',    'Wiam Lamnaouar',    '712020:32b00664', 'technician'),
  ('hiba.ibourk@uit.ac.ma',       'Hiba Ibourk',       '712020:edc7b1d1', 'technician'),
  ('asmae.mouhanni@uit.ac.ma',    'Asmae Mouhanni',    '712020:adc6d883', 'technician');

-- ============================================================
-- 4. PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  jira_email TEXT,
  jira_account_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. USER ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role-check function (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============================================================
-- 6. NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                  -- 'ticket_assigned', 'suggestion_approved', 'ticket_stuck', 'info'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- Profiles
CREATE POLICY "Profiles: own select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Profiles: own update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Profiles: own insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- User roles
CREATE POLICY "Roles: select own or manager"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'manager'));

-- No direct insert/update/delete from clients (only trigger / admin)

-- Notifications
CREATE POLICY "Notif: own select"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Notif: own update"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Notif: own delete"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Inserts come from server (service role) — no client insert policy needed.

-- ============================================================
-- 8. AUTO-CREATE PROFILE + ROLE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seed RECORD;
  assigned_role public.app_role;
  display TEXT;
BEGIN
  SELECT * INTO seed FROM public.team_seed WHERE email = NEW.email;

  IF FOUND THEN
    assigned_role := seed.role;
    display := seed.display_name;
  ELSE
    assigned_role := 'technician';
    display := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
  END IF;

  INSERT INTO public.profiles (id, email, display_name, jira_email, jira_account_id)
  VALUES (
    NEW.id,
    NEW.email,
    display,
    CASE WHEN seed.email IS NOT NULL THEN seed.email ELSE NEW.email END,
    seed.jira_account_id
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();