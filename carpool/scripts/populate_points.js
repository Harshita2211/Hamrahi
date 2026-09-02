import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run this script');
  process.exitCode = 1;
  process.exit();
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function populate() {
  console.log('Fetching trips without origin/destination points...');
  const { data, error } = await supabase
    .from('trips')
    .select('id')
    .is('route_geojson', null);

  if (error) {
    console.error('Failed to query trips:', error.message || error);
    process.exitCode = 2;
    return;
  }

  if (!data || data.length === 0) {
    console.log('No trips found with route_geojson = NULL. Trying trips with route_geojson present but points missing.');
  }

  // Instead, find trips where route_geojson is not null and origin_point is null
  const { data: rows, error: qerr } = await supabase
    .from('trips')
    .select('id')
    .not('route_geojson', 'is', null)
    .is('origin_point', null)
    .limit(1000);

  if (qerr) {
    console.error('Query error:', qerr.message || qerr);
    process.exitCode = 2;
    return;
  }

  if (!rows || rows.length === 0) {
    console.log('No trips need population. Nothing to do.');
    return;
  }

  console.log(`Found ${rows.length} trips to populate`);

  for (const r of rows) {
    const id = r.id;
    console.log('Calling RPC for trip', id);
    const { error: rpcErr } = await supabase.rpc('populate_trip_points', { trip_id: id });
    if (rpcErr) {
      console.error('RPC error for', id, rpcErr.message || rpcErr);
    } else {
      console.log('Populated trip', id);
    }
  }
}

populate().catch((err) => {
  console.error('Unexpected error:', err);
  process.exitCode = 10;
});
