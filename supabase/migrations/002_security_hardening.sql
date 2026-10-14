-- ============================================
-- MIGRATION 002: Security hardening
-- Fixes: 1.2 (admin role prevention), 1.4 (tighter RLS)
-- ============================================

-- 1.2 FIX: Prevent anyone from registering as admin via metadata manipulation.
-- The trigger now rejects 'admin' role from signup metadata — only 'user' and 'driver' are allowed.
-- Admin accounts must be created manually via Supabase dashboard or SQL.
-- 2.6 FIX: Automatically create drivers table record if registering as driver.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT;
BEGIN
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');

  -- Only allow 'user' or 'driver' from self-registration
  IF requested_role NOT IN ('user', 'driver') THEN
    requested_role := 'user';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    requested_role
  );

  -- 2.6 FIX: Automatically create driver record in public.drivers table
  IF requested_role = 'driver' THEN
    INSERT INTO public.drivers (profile_id, vehicle_number, vehicle_type)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'vehicle_number', 'PENDING'),
      COALESCE(NEW.raw_user_meta_data->>'vehicle_type', 'basic')
    )
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1.4 FIX: Tighten booking RLS policies.
-- Remove the overly permissive "Drivers can accept pending bookings" policy
-- and replace with one that only allows setting driver_id and status on pending bookings.

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Drivers can accept pending bookings" ON public.bookings;

-- New policy: Drivers can only UPDATE pending bookings (to accept them)
-- This still allows the update but RLS alone can't restrict columns —
-- so we add a trigger to enforce which columns a driver can change.
CREATE POLICY "Drivers can accept pending bookings"
  ON public.bookings FOR UPDATE
  USING (status = 'pending')
  WITH CHECK (
    status IN ('pending', 'accepted')
    AND driver_id IN (
      SELECT id FROM public.drivers WHERE profile_id = auth.uid()
    )
  );

-- Column-level protection trigger: prevent drivers from modifying
-- fields they shouldn't touch when accepting a booking
CREATE OR REPLACE FUNCTION public.guard_booking_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user changing the booking is a driver (not admin), restrict changes
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver'
  ) THEN
    -- Drivers can only change: status, driver_id, accepted_at
    -- Everything else must stay the same
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
       OR NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
       OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng
       OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
    THEN
      RAISE EXCEPTION 'Drivers cannot modify booking details, only status transitions';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS guard_booking_update_trigger ON public.bookings;
CREATE TRIGGER guard_booking_update_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_update();
