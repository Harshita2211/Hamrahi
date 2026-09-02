-- Populate origin_point and destination_point from route_geojson
-- Usage: SELECT public.populate_trip_points('<trip-uuid>');

CREATE OR REPLACE FUNCTION public.populate_trip_points(trip_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  r jsonb;
  len int;
  lon double precision;
  lat double precision;
  lon2 double precision;
  lat2 double precision;
BEGIN
  SELECT route_geojson INTO r FROM public.trips WHERE id = trip_id;
  IF r IS NULL THEN
    RETURN;
  END IF;

  -- If stored as text, try to cast
  IF jsonb_typeof(r) = 'string' THEN
    BEGIN
      r := r::jsonb;
    EXCEPTION WHEN others THEN
      RETURN;
    END;
  END IF;

  -- Ensure geometry exists
  IF NOT (r ? 'geometry') THEN
    RETURN;
  END IF;

  len := jsonb_array_length(r->'geometry'->'coordinates');
  IF len IS NULL OR len < 1 THEN
    RETURN;
  END IF;

  lon := (r->'geometry'->'coordinates'->0->>0)::double precision;
  lat := (r->'geometry'->'coordinates'->0->>1)::double precision;
  lon2 := (r->'geometry'->'coordinates'->(len-1)->>0)::double precision;
  lat2 := (r->'geometry'->'coordinates'->(len-1)->>1)::double precision;

  UPDATE public.trips
  SET origin_point = ST_SetSRID(ST_MakePoint(lon, lat), 4326),
      destination_point = ST_SetSRID(ST_MakePoint(lon2, lat2), 4326),
      updated_at = NOW()
  WHERE id = trip_id;
END;
$$;

-- Grant execute to anon if desired (be careful with service role security)
-- GRANT EXECUTE ON FUNCTION public.populate_trip_points(UUID) TO anon;
