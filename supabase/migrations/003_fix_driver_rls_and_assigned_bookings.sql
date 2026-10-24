-- ============================================
-- MIGRATION 003: Fix driver RLS policies for bookings & profile visibility
-- ============================================

-- 1. Fix "Drivers can accept pending bookings" UPDATE policy
-- Crucial: Must specify WITH CHECK (status IN ('pending', 'accepted')), otherwise PostgreSQL
-- re-uses the USING (status = 'pending') as the check for the NEW row, causing
-- "new row violates row-level security policy for table bookings"!
DROP POLICY IF EXISTS "Drivers can accept pending bookings" ON public.bookings;
CREATE POLICY "Drivers can accept pending bookings"
  ON public.bookings FOR UPDATE
  USING (status = 'pending')
  WITH CHECK (
    status IN ('pending', 'accepted')
    AND (
      driver_id IS NULL
      OR driver_id IN (
        SELECT id FROM public.drivers WHERE profile_id = auth.uid()
      )
    )
  );

-- 2. Fix "Drivers can update bookings assigned to them" UPDATE policy
DROP POLICY IF EXISTS "Drivers can update bookings assigned to them" ON public.bookings;
CREATE POLICY "Drivers can update bookings assigned to them"
  ON public.bookings FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.drivers WHERE profile_id = auth.uid()
    )
  );

-- 3. Fix "Users can cancel own pending bookings" UPDATE policy
DROP POLICY IF EXISTS "Users can cancel own pending bookings" ON public.bookings;
CREATE POLICY "Users can cancel own pending bookings"
  ON public.bookings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Allow drivers to view bookings assigned to them (for active and completed trips)
DROP POLICY IF EXISTS "Drivers can view assigned bookings" ON public.bookings;
CREATE POLICY "Drivers can view assigned bookings"
  ON public.bookings FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE profile_id = auth.uid()
    )
  );

-- 5. Allow drivers to view patient profiles for pending or assigned bookings
DROP POLICY IF EXISTS "Drivers can view patient profiles for bookings" ON public.profiles;
CREATE POLICY "Drivers can view patient profiles for bookings"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.profile_id = auth.uid()
      AND (
        EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.user_id = public.profiles.id
          AND (b.status = 'pending' OR b.driver_id = d.id)
        )
      )
    )
  );

-- 6. Allow patients/users to view driver profiles for their bookings
DROP POLICY IF EXISTS "Patients can view assigned driver profiles" ON public.profiles;
CREATE POLICY "Patients can view assigned driver profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.drivers d ON b.driver_id = d.id
      WHERE b.user_id = auth.uid()
      AND d.profile_id = public.profiles.id
    )
  );
