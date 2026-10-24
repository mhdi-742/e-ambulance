-- ============================================
-- MIGRATION 004: Complete Security, Trigger & Schema Fixes
-- ============================================
-- 1. Create a secure helper to check admin role from public.profiles
-- Uses SECURITY DEFINER to avoid infinite RLS recursion on public.profiles
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$ BEGIN RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
-- 2. Prevent users from escalating their own role in public.profiles
CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS TRIGGER AS $$ BEGIN IF NEW.role IS DISTINCT
FROM OLD.role
    AND NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized to change account role';
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS guard_profile_update_trigger ON public.profiles;
CREATE TRIGGER guard_profile_update_trigger BEFORE
UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();
-- 3. Fix Admin RLS policy on public.profiles (replace insecure user_metadata check)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR ALL USING (public.is_admin());
-- 4. Fix Drivers RLS: allow patients to view drivers assigned to their bookings even when offline
DROP POLICY IF EXISTS "Patients can view drivers assigned to their bookings" ON public.drivers;
CREATE POLICY "Patients can view drivers assigned to their bookings" ON public.drivers FOR
SELECT USING (
        id IN (
            SELECT driver_id
            FROM public.bookings
            WHERE user_id = auth.uid()
                AND driver_id IS NOT NULL
        )
    );
-- 5. Fix Bookings RLS: restrict viewing pending bookings to registered drivers only
DROP POLICY IF EXISTS "Drivers can view pending bookings" ON public.bookings;
CREATE POLICY "Drivers can view pending bookings" ON public.bookings FOR
SELECT USING (
        status = 'pending'
        AND EXISTS (
            SELECT 1
            FROM public.drivers
            WHERE profile_id = auth.uid()
        )
    );
-- 6. Fix Bookings RLS: tighten driver acceptance policy (remove driver_id IS NULL regression)
DROP POLICY IF EXISTS "Drivers can accept pending bookings" ON public.bookings;
CREATE POLICY "Drivers can accept pending bookings" ON public.bookings FOR
UPDATE USING (status = 'pending') WITH CHECK (
        status = 'accepted'
        AND driver_id IN (
            SELECT id
            FROM public.drivers
            WHERE profile_id = auth.uid()
        )
    );
-- 7. Upgrade guard_booking_update() to enforce rules for BOTH drivers and patients,
--    and automatically set timestamps (accepted_at, completed_at)
CREATE OR REPLACE FUNCTION public.guard_booking_update() RETURNS TRIGGER AS $$
DECLARE caller_role TEXT;
BEGIN
SELECT role INTO caller_role
FROM public.profiles
WHERE id = auth.uid();
-- Rule A: Driver restrictions
IF caller_role = 'driver' THEN IF NEW.user_id IS DISTINCT
FROM OLD.user_id
    OR NEW.hospital_id IS DISTINCT
FROM OLD.hospital_id
    OR NEW.pickup_lat IS DISTINCT
FROM OLD.pickup_lat
    OR NEW.pickup_lng IS DISTINCT
FROM OLD.pickup_lng
    OR NEW.pickup_address IS DISTINCT
FROM OLD.pickup_address THEN RAISE EXCEPTION 'Drivers cannot modify booking details, only status transitions';
END IF;
END IF;
-- Rule B: Patient (user) restrictions — can ONLY cancel their own pending/accepted booking
IF caller_role = 'user' THEN IF OLD.status NOT IN ('pending', 'accepted')
OR NEW.status <> 'cancelled'
OR NEW.user_id IS DISTINCT
FROM OLD.user_id
    OR NEW.driver_id IS DISTINCT
FROM OLD.driver_id
    OR NEW.hospital_id IS DISTINCT
FROM OLD.hospital_id
    OR NEW.pickup_lat IS DISTINCT
FROM OLD.pickup_lat
    OR NEW.pickup_lng IS DISTINCT
FROM OLD.pickup_lng
    OR NEW.pickup_address IS DISTINCT
FROM OLD.pickup_address THEN RAISE EXCEPTION 'Patients can only cancel pending or accepted bookings';
END IF;
END IF;
-- Automatically stamp accepted_at and completed_at
IF NEW.status = 'accepted'
AND OLD.status <> 'accepted' THEN NEW.accepted_at := COALESCE(NEW.accepted_at, NOW());
END IF;
IF NEW.status = 'completed'
AND OLD.status <> 'completed' THEN NEW.completed_at := COALESCE(NEW.completed_at, NOW());
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 8. Automatically sync drivers.is_busy when booking status changes
--    (Fixes bug where patient cancelling an accepted booking could not free the driver due to RLS)
CREATE OR REPLACE FUNCTION public.sync_driver_busy_state() RETURNS TRIGGER AS $$ BEGIN -- Driver accepted or is on an active trip -> mark busy
    IF NEW.driver_id IS NOT NULL
    AND NEW.status IN (
        'accepted',
        'en_route_pickup',
        'arrived_pickup',
        'en_route_hospital'
    ) THEN
UPDATE public.drivers
SET is_busy = TRUE
WHERE id = NEW.driver_id;
END IF;
-- Trip completed or cancelled -> free the driver if they have no other active trips
IF NEW.driver_id IS NOT NULL
AND NEW.status IN ('completed', 'cancelled') THEN
UPDATE public.drivers
SET is_busy = FALSE
WHERE id = NEW.driver_id
    AND NOT EXISTS (
        SELECT 1
        FROM public.bookings
        WHERE driver_id = NEW.driver_id
            AND id <> NEW.id
            AND status IN (
                'accepted',
                'en_route_pickup',
                'arrived_pickup',
                'en_route_hospital'
            )
    );
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS sync_driver_busy_trigger ON public.bookings;
CREATE TRIGGER sync_driver_busy_trigger
AFTER
INSERT
    OR
UPDATE OF status,
    driver_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.sync_driver_busy_state();
-- 9. Deduplicate hospitals & add UNIQUE(name) so seed.sql ON CONFLICT DO NOTHING works
DELETE FROM public.hospitals a USING public.hospitals b
WHERE a.id > b.id
    AND a.name = b.name;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hospitals_name_key'
) THEN
ALTER TABLE public.hospitals
ADD CONSTRAINT hospitals_name_key UNIQUE (name);
END IF;
END $$;
-- 10. Prevent concurrent duplicate active bookings per user or per driver
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_per_user ON public.bookings(user_id)
WHERE status IN (
        'pending',
        'accepted',
        'en_route_pickup',
        'arrived_pickup',
        'en_route_hospital'
    );
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_per_driver ON public.bookings(driver_id)
WHERE driver_id IS NOT NULL
    AND status IN (
        'accepted',
        'en_route_pickup',
        'arrived_pickup',
        'en_route_hospital'
    );