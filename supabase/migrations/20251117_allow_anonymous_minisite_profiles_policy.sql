-- Migration: Allow anonymous (no user_id) inserts into minisite_profiles
-- Date: 2025-11-17
-- Purpose: Permit the frontend to create temporary/anonymous minisite profiles
-- (rows without `user_id`) so guest users can create a profile that can later
-- be claimed/linked to an authenticated Supabase user after they confirm/login.
--
-- IMPORTANT: this relaxes RLS for INSERT only — it does NOT expose anonymous
-- rows for general SELECT/UPDATE/DELETE. The intended flow is:
--  1) Anonymous client INSERTs a row with `user_id = NULL` and receives the
--     created `id` back in the insert response (store locally in the browser).
--  2) When the user signs up / logs in, the client calls UPDATE on that row and
--     sets `user_id = auth.uid()`. The UPDATE policy below allows an
--     authenticated user to "claim" an anonymous row (old.user_id IS NULL)
--     and set its `user_id` to their uid.
--
-- Risks & recommendations:
--  - Anonymous rows are not globally readable via SELECT by other users.
--  - Allowing anonymous INSERT is relatively low-risk if you do NOT allow
--    anonymous SELECT or UPDATE by others. We enforce that by restricting
--    SELECT/DELETE to owners only and allowing UPDATE only to owners or when
--    claiming a NULL user_id row.
--  - After applying this migration, update the frontend to:
--      * Save the created profile `id` in localStorage as `pending_profile_id`.
--      * After login, call UPDATE to set `user_id` on that profile id.
--  - If you prefer server-side control, implement a protected endpoint that
--    performs the linking using the service role key instead of loosening RLS.
--
BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.minisite_profiles ENABLE ROW LEVEL SECURITY;

-- INSERT policy: allow authenticated inserts that set user_id = auth.uid()
-- OR allow anonymous inserts that do NOT set user_id (new.user_id IS NULL)
DROP POLICY IF EXISTS minisite_profiles_insert_policy ON public.minisite_profiles;
CREATE POLICY minisite_profiles_insert_policy ON public.minisite_profiles
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

-- SELECT policy: only the owner (authenticated user matching user_id) can SELECT
DROP POLICY IF EXISTS minisite_profiles_select_policy ON public.minisite_profiles;
CREATE POLICY minisite_profiles_select_policy ON public.minisite_profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND auth.uid() = user_id
  );

-- UPDATE policy: allow owner to update; additionally allow an authenticated
-- user to claim an anonymous row (old.user_id IS NULL). After update, ensure
-- new.user_id equals auth.uid().
DROP POLICY IF EXISTS minisite_profiles_update_policy ON public.minisite_profiles;
CREATE POLICY minisite_profiles_update_policy ON public.minisite_profiles
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.uid() IS NOT NULL AND user_id IS NULL)
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid() = user_id
  );

-- DELETE policy: only owner may delete their profile
DROP POLICY IF EXISTS minisite_profiles_delete_policy ON public.minisite_profiles;
CREATE POLICY minisite_profiles_delete_policy ON public.minisite_profiles
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND auth.uid() = user_id
  );

COMMIT;
