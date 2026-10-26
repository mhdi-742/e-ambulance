-- ============================================
-- MIGRATION 004: Complete Security, Trigger, RLS Recursion & Schema Fixes
-- ============================================

-- 1. Create SECURITY DEFINER helper functions to prevent infinite RLS recursion
--    between public.profiles, public.drivers, and public.bookings.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_my_driver_id()
RETURNS UUID AS $$
    SELECT id
    FROM public.drivers
    WHERE profile_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_my_assigned_driver_ids()
RETURNS SETOF UUID AS $$
    SELECT driver_id
    FROM public.bookings
    WHERE user_id = auth.uid()
        AND driver_id IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_driver_view_patient_profile(target_profile_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.drivers d
        JOIN public.bookings b ON (b.status = 'pending' OR b.driver_id = d.id)
        WHERE d.profile_id = auth.uid()
            AND b.user_id = target_profile_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_patient_view_driver_profile(target_profile_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.bookings b
        JOIN public.drivers d ON b.driver_id = d.id
        WHERE b.user_id = auth.uid()
            AND d.profile_id = target_profile_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Backfill any missing public.drivers rows for accounts with role = 'driver'
INSERT INTO public.drivers (profile_id, vehicle_number, vehicle_type)
SELECT
    p.id,
    COALESCE(NULLIF(u.raw_user_meta_data->>'vehicle_number', ''), 'PENDING'),
    CASE
        WHEN (u.raw_user_meta_data->>'vehicle_type') IN ('basic', 'icu')
        THEN u.raw_user_meta_data->>'vehicle_type'
        ELSE 'basic'
    END
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.role = 'driver'
ON CONFLICT (profile_id) DO NOTHING;

-- 3. Prevent users from escalating their own role in public.profiles
CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Not authorized to change account role';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS guard_profile_update_trigger ON public.profiles;
CREATE TRIGGER guard_profile_update_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- 4. Fix Profiles RLS policies (using SECURITY DEFINER helpers to avoid recursion)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Drivers can view patient profiles for bookings" ON public.profiles;
CREATE POLICY "Drivers can view patient profiles for bookings" ON public.profiles
    FOR SELECT USING (public.can_driver_view_patient_profile(id));

DROP POLICY IF EXISTS "Patients can view assigned driver profiles" ON public.profiles;
CREATE POLICY "Patients can view assigned driver profiles" ON public.profiles
    FOR SELECT USING (public.can_patient_view_driver_profile(id));

-- 5. Fix Drivers RLS policies (using SECURITY DEFINER helpers — fixes 42P17 infinite recursion)
DROP POLICY IF EXISTS "Drivers can view and update own record" ON public.drivers;
CREATE POLICY "Drivers can view and update own record" ON public.drivers
    FOR ALL
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Patients can view drivers assigned to their bookings" ON public.drivers;
CREATE POLICY "Patients can view drivers assigned to their bookings" ON public.drivers
    FOR SELECT USING (id IN (SELECT public.get_my_assigned_driver_ids()));

DROP POLICY IF EXISTS "Admins can manage all drivers" ON public.drivers;
CREATE POLICY "Admins can manage all drivers" ON public.drivers
    FOR ALL USING (public.is_admin());

-- 6. Fix Bookings RLS policies (using public.get_my_driver_id() and public.is_admin())
DROP POLICY IF EXISTS "Drivers can view pending bookings" ON public.bookings;
CREATE POLICY "Drivers can view pending bookings" ON public.bookings
    FOR SELECT USING (
        status = 'pending'
        AND public.get_my_driver_id() IS NOT NULL
    );

DROP POLICY IF EXISTS "Drivers can view assigned bookings" ON public.bookings;
CREATE POLICY "Drivers can view assigned bookings" ON public.bookings
    FOR SELECT USING (
        driver_id = public.get_my_driver_id()
    );

DROP POLICY IF EXISTS "Drivers can accept pending bookings" ON public.bookings;
CREATE POLICY "Drivers can accept pending bookings" ON public.bookings
    FOR UPDATE USING (
        status = 'pending'
        AND public.get_my_driver_id() IS NOT NULL
    )
    WITH CHECK (
        status IN ('pending', 'accepted')
        AND driver_id = public.get_my_driver_id()
    );

DROP POLICY IF EXISTS "Drivers can update bookings assigned to them" ON public.bookings;
CREATE POLICY "Drivers can update bookings assigned to them" ON public.bookings
    FOR UPDATE USING (
        driver_id = public.get_my_driver_id()
    )
    WITH CHECK (
        driver_id = public.get_my_driver_id()
    );

DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
CREATE POLICY "Admins can manage all bookings" ON public.bookings
    FOR ALL USING (public.is_admin());

-- 7. Fix Hospitals & Location Logs Admin RLS policies to use public.is_admin()
DROP POLICY IF EXISTS "Admins can manage hospitals" ON public.hospitals;
CREATE POLICY "Admins can manage hospitals" ON public.hospitals
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Drivers can insert own location logs" ON public.location_logs;
CREATE POLICY "Drivers can insert own location logs" ON public.location_logs
    FOR INSERT WITH CHECK (
        driver_id = public.get_my_driver_id()
    );

DROP POLICY IF EXISTS "Admins can view all logs" ON public.location_logs;
CREATE POLICY "Admins can view all logs" ON public.location_logs
    FOR ALL USING (public.is_admin());

-- 8. Upgrade guard_booking_update() to enforce rules for BOTH drivers and patients,
--    forbid transitions out of completed/cancelled, and automatically set timestamps
CREATE OR REPLACE FUNCTION public.guard_booking_update() RETURNS TRIGGER AS $$
DECLARE
    caller_role TEXT;
BEGIN
    SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    -- Rule 0: Terminal state protection (cannot transition out of completed or cancelled)
    IF OLD.status IN ('completed', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Cannot modify status of a completed or cancelled booking';
    END IF;

    -- Rule A: Driver restrictions
    IF caller_role = 'driver' THEN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id
            OR NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
            OR NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
            OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng
            OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
        THEN
            RAISE EXCEPTION 'Drivers cannot modify booking details, only status transitions';
        END IF;
    END IF;

    -- Rule B: Patient (user) restrictions — can ONLY cancel their own pending/accepted booking
    IF caller_role = 'user' THEN
        IF OLD.status NOT IN ('pending', 'accepted')
            OR NEW.status <> 'cancelled'
            OR NEW.user_id IS DISTINCT FROM OLD.user_id
            OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
            OR NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
            OR NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
            OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng
            OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
        THEN
            RAISE EXCEPTION 'Patients can only cancel pending or accepted bookings';
        END IF;
    END IF;

    -- Automatically stamp accepted_at and completed_at
    IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
        NEW.accepted_at := COALESCE(NEW.accepted_at, NOW());
    END IF;
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        NEW.completed_at := COALESCE(NEW.completed_at, NOW());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS guard_booking_update_trigger ON public.bookings;
CREATE TRIGGER guard_booking_update_trigger
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.guard_booking_update();

-- 9. Automatically sync drivers.is_busy when booking status changes
CREATE OR REPLACE FUNCTION public.sync_driver_busy_state() RETURNS TRIGGER AS $$
BEGIN
    -- Driver accepted or is on an active trip -> mark busy
    IF NEW.driver_id IS NOT NULL
        AND NEW.status IN (
            'accepted',
            'en_route_pickup',
            'arrived_pickup',
            'en_route_hospital'
        )
    THEN
        UPDATE public.drivers
        SET is_busy = TRUE
        WHERE id = NEW.driver_id;
    END IF;

    -- Trip completed or cancelled -> free the driver if they have no other active trips
    IF NEW.driver_id IS NOT NULL
        AND NEW.status IN ('completed', 'cancelled')
    THEN
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
    AFTER INSERT OR UPDATE OF status, driver_id ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.sync_driver_busy_state();

-- 10. Deduplicate hospitals & add UNIQUE(name) so seed.sql ON CONFLICT DO NOTHING works
DELETE FROM public.hospitals a USING public.hospitals b
WHERE a.id > b.id
    AND a.name = b.name;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hospitals_name_key'
    ) THEN
        ALTER TABLE public.hospitals
        ADD CONSTRAINT hospitals_name_key UNIQUE (name);
    END IF;
END $$;

-- 11. Clean up any legacy duplicate active bookings before creating unique partial indexes
UPDATE public.bookings a
SET status = 'cancelled',
    cancel_reason = 'Auto-cancelled duplicate active booking'
WHERE a.status IN (
        'pending',
        'accepted',
        'en_route_pickup',
        'arrived_pickup',
        'en_route_hospital'
    )
    AND EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.user_id = a.user_id
            AND b.status IN (
                'pending',
                'accepted',
                'en_route_pickup',
                'arrived_pickup',
                'en_route_hospital'
            )
            AND (
                b.created_at > a.created_at
                OR (b.created_at = a.created_at AND b.id > a.id)
            )
    );

UPDATE public.bookings a
SET status = 'cancelled',
    cancel_reason = 'Auto-cancelled duplicate active driver assignment'
WHERE a.driver_id IS NOT NULL
    AND a.status IN (
        'accepted',
        'en_route_pickup',
        'arrived_pickup',
        'en_route_hospital'
    )
    AND EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.driver_id = a.driver_id
            AND b.status IN (
                'accepted',
                'en_route_pickup',
                'arrived_pickup',
                'en_route_hospital'
            )
            AND (
                b.created_at > a.created_at
                OR (b.created_at = a.created_at AND b.id > a.id)
            )
    );

-- Prevent concurrent duplicate active bookings per user or per driver
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

-- 12. Ensure all live-tracked tables are in the supabase_realtime publication
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['bookings', 'drivers', 'profiles', 'location_logs']
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        END IF;
    END LOOP;
END $$;
