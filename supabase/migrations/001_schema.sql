-- ============================================
-- E-AMBULANCE DATABASE SCHEMA
-- Supabase PostgreSQL Migration
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'driver', 'admin')),
  avatar_url TEXT DEFAULT '',
  session_token TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- HOSPITALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DRIVERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL DEFAULT '',
  vehicle_type TEXT DEFAULT 'basic' CHECK (vehicle_type IN ('basic', 'icu')),
  is_online BOOLEAN DEFAULT FALSE,
  is_busy BOOLEAN DEFAULT FALSE,
  current_lat DOUBLE PRECISION DEFAULT 0,
  current_lng DOUBLE PRECISION DEFAULT 0,
  last_location_update TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  driver_id UUID REFERENCES public.drivers(id),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id),
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'en_route_pickup', 'arrived_pickup', 'en_route_hospital', 'completed', 'cancelled')),
  cancel_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================
-- LOCATION LOGS TABLE (for trip tracking history)
-- ============================================
CREATE TABLE IF NOT EXISTS public.location_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Hospitals
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active hospitals"
  ON public.hospitals FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage hospitals"
  ON public.hospitals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view and update own record"
  ON public.drivers FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Users can view online drivers"
  ON public.drivers FOR SELECT
  USING (is_online = TRUE);

CREATE POLICY "Admins can manage all drivers"
  ON public.drivers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can cancel own pending bookings"
  ON public.bookings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Drivers can view pending bookings"
  ON public.bookings FOR SELECT
  USING (status = 'pending');

CREATE POLICY "Drivers can update bookings assigned to them"
  ON public.bookings FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can accept pending bookings"
  ON public.bookings FOR UPDATE
  USING (status = 'pending');

CREATE POLICY "Admins can manage all bookings"
  ON public.bookings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Location Logs
ALTER TABLE public.location_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can insert own location logs"
  ON public.location_logs FOR INSERT
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.drivers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can view logs for own bookings"
  ON public.location_logs FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM public.bookings WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all logs"
  ON public.location_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_id ON public.bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_drivers_is_online ON public.drivers(is_online);
CREATE INDEX IF NOT EXISTS idx_drivers_profile_id ON public.drivers(profile_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_booking ON public.location_logs(booking_id);
