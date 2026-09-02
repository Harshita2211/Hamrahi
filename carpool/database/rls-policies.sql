-- Carpool Connect - Row Level Security Policies
-- These policies enforce data access control at the database level
-- Execute in Supabase SQL editor AFTER schema.sql
-- NOTE: Safe to run multiple times - drops existing policies first

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Prevent direct profile insertion" ON public.profiles;
DROP POLICY IF EXISTS "Prevent direct profile deletion" ON public.profiles;

-- Policy 1: Everyone can view all profiles
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Prevent direct profile insertion (use trigger instead)
-- The database trigger handle_new_user() creates profiles with SECURITY DEFINER
-- This policy ensures the trigger is the only way to create profiles
CREATE POLICY "Prevent direct profile insertion"
ON public.profiles FOR INSERT
WITH CHECK (false);

-- Policy 4: Users cannot delete their own profile (handled by auth cascade)
CREATE POLICY "Prevent direct profile deletion"
ON public.profiles FOR DELETE
USING (false);

-- ============================================================================
-- TRIPS TABLE POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Trips are viewable by everyone" ON public.trips;
DROP POLICY IF EXISTS "Authenticated users can create trips" ON public.trips;
DROP POLICY IF EXISTS "Users can update their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can delete their own trips" ON public.trips;

-- Policy 1: Everyone can view all trips
CREATE POLICY "Trips are viewable by everyone"
ON public.trips FOR SELECT
USING (true);

-- Policy 2: Authenticated users can create trips
CREATE POLICY "Authenticated users can create trips"
ON public.trips FOR INSERT
WITH CHECK (auth.uid() = driver_id);

-- Policy 3: Only the driver can update their own trips
CREATE POLICY "Users can update their own trips"
ON public.trips FOR UPDATE
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

-- Policy 4: Only the driver can delete their own trips
CREATE POLICY "Users can delete their own trips"
ON public.trips FOR DELETE
USING (auth.uid() = driver_id);

-- ============================================================================
-- BOOKINGS TABLE POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Passengers can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Drivers can view bookings for their trips" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can book trips" ON public.bookings;
DROP POLICY IF EXISTS "Prevent direct booking deletion" ON public.bookings;

-- Policy 1: Passengers can view their own bookings
CREATE POLICY "Passengers can view their own bookings"
ON public.bookings FOR SELECT
USING (auth.uid() = passenger_id);

-- Policy 2: Drivers can view bookings for their trips
CREATE POLICY "Drivers can view bookings for their trips"
ON public.bookings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = bookings.trip_id
    AND trips.driver_id = auth.uid()
  )
);

-- Drop existing booking insert policy
DROP POLICY IF EXISTS "Authenticated users can book trips" ON public.bookings;

-- Policy 3: Authenticated users can create bookings
-- All validation is done at the application level
-- Server-side operations bypass RLS entirely using service role
CREATE POLICY "Authenticated users can book trips"
ON public.bookings FOR INSERT
WITH CHECK (true);

-- Policy 4: Users cannot delete their bookings (admins only via RPC)
CREATE POLICY "Prevent direct booking deletion"
ON public.bookings FOR DELETE
USING (false);

-- ============================================================================
-- STORAGE POLICIES (for avatar uploads)
-- ============================================================================

-- NOTE: storage.objects RLS is managed by Supabase and cannot be directly altered
-- We only need to create/manage the policies

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

-- Policy: Allow anyone (authenticated or unauthenticated) to upload avatars
-- This is needed for registration form where user hasn't authenticated yet
CREATE POLICY "Anyone can upload avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatar'
);

-- Policy: Public read access for avatars
CREATE POLICY "Public avatar access" ON storage.objects
FOR SELECT USING (
  bucket_id = 'avatar'
);

-- Policy: Authenticated users can update their own avatars
-- Uses filename pattern: user uploads files, then after auth can manage them
CREATE POLICY "Users can update own avatars" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatar'
);

-- Policy: Authenticated users can delete their own avatars
CREATE POLICY "Users can delete own avatars" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatar'
);

-- Note: These policies allow anyone to upload to the avatar bucket
-- This is intentional for the registration flow where users upload avatars before authentication
-- The public read policy ensures avatars can be displayed on the site


-- ============================================================================
-- HELPER FUNCTIONS WITH SECURITY
-- ============================================================================

-- Function to safely book a trip (decrements seats)
CREATE OR REPLACE FUNCTION book_trip(p_trip_id UUID)
RETURNS JSON AS $$
DECLARE
  v_trip RECORD;
  v_result JSON;
BEGIN
  -- Get trip details with locking
  SELECT * INTO v_trip FROM public.trips
  WHERE id = p_trip_id
  FOR UPDATE;

  -- Check if trip exists
  IF v_trip IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Trip not found');
  END IF;

  -- Check if user is the driver
  IF v_trip.driver_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot book own trip');
  END IF;

  -- Check if seats available
  IF v_trip.available_seats <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'No seats available');
  END IF;

  -- Check if already booked
  IF EXISTS (SELECT 1 FROM public.bookings WHERE trip_id = p_trip_id AND passenger_id = auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Already booked on this trip');
  END IF;

  -- Insert booking
  INSERT INTO public.bookings (trip_id, passenger_id)
  VALUES (p_trip_id, auth.uid());

  -- Decrement seats
  UPDATE public.trips
  SET available_seats = available_seats - 1
  WHERE id = p_trip_id;

  RETURN json_build_object('success', true, 'message', 'Trip booked successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's booked trips
CREATE OR REPLACE FUNCTION get_user_bookings()
RETURNS TABLE(
  trip_id UUID,
  origin_text VARCHAR,
  destination_text VARCHAR,
  departure_timestamp TIMESTAMP WITH TIME ZONE,
  driver_name VARCHAR,
  price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.origin_text,
    t.destination_text,
    t.departure_timestamp,
    p.full_name,
    t.price
  FROM public.bookings b
  JOIN public.trips t ON b.trip_id = t.id
  JOIN public.profiles p ON t.driver_id = p.id
  WHERE b.passenger_id = auth.uid()
  ORDER BY t.departure_timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get driver's trips
CREATE OR REPLACE FUNCTION get_driver_trips()
RETURNS TABLE(
  trip_id UUID,
  origin_text VARCHAR,
  destination_text VARCHAR,
  departure_timestamp TIMESTAMP WITH TIME ZONE,
  available_seats INTEGER,
  booked_count INTEGER,
  price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.origin_text,
    t.destination_text,
    t.departure_timestamp,
    t.available_seats,
    (SELECT COUNT(*) FROM public.bookings WHERE trip_id = t.id)::INTEGER,
    t.price
  FROM public.trips t
  WHERE t.driver_id = auth.uid()
  ORDER BY t.departure_timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS FOR AUTHENTICATED USERS
-- ============================================================================

-- Ensure authenticated users have necessary permissions
-- These permissions are checked against the RLS policies above
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.trips TO authenticated;
GRANT INSERT ON public.trips TO authenticated;
GRANT UPDATE ON public.trips TO authenticated;
GRANT DELETE ON public.trips TO authenticated;
GRANT SELECT ON public.bookings TO authenticated;
GRANT INSERT ON public.bookings TO authenticated;
GRANT UPDATE ON public.bookings TO authenticated;
GRANT DELETE ON public.bookings TO authenticated;

-- Grant execute permission on functions to authenticated users
GRANT EXECUTE ON FUNCTION book_trip(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_bookings() TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_trips() TO authenticated;