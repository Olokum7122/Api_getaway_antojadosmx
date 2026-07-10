'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const sql = require('mssql');

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--apply');
const force = args.has('--force');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const cityArg = process.argv.find((arg) => arg.startsWith('--city='));
const zoneArg = process.argv.find((arg) => arg.startsWith('--zone='));
const delayArg = process.argv.find((arg) => arg.startsWith('--delay-ms='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 25) : 25;
const onlyCityCode = cityArg ? String(cityArg.split('=').slice(1).join('=') || '').trim().toUpperCase() : null;
const onlyZoneCode = zoneArg ? String(zoneArg.split('=').slice(1).join('=') || '').trim().toUpperCase() : null;
const delayMs = delayArg ? Math.max(0, Number(delayArg.split('=')[1]) || 0) : 150;

function getConfig() {
  return {
    server: process.env.GT_ANTOJADOS_SERVER,
    port: parseInt(process.env.GT_ANTOJADOS_PORT || '1433', 10),
    database: process.env.GT_ANTOJADOS_NAME,
    user: process.env.GT_ANTOJADOS_USER,
    password: process.env.GT_ANTOJADOS_PASS,
    options: {
      encrypt: String(process.env.GT_ANTOJADOS_ENCRYPT || 'false') === 'true',
      trustServerCertificate: String(process.env.GT_ANTOJADOS_TRUST_CERT || 'true') === 'true',
    },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value, decimals = 6) {
  return Number(Number(value).toFixed(decimals));
}

function haversineKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.asin(Math.sqrt(h));
}

function radiusFromViewport(center, viewport) {
  if (!viewport?.northeast || !viewport?.southwest) return 25;

  const ne = { lat: Number(viewport.northeast.lat), lng: Number(viewport.northeast.lng) };
  const sw = { lat: Number(viewport.southwest.lat), lng: Number(viewport.southwest.lng) };
  if (![ne.lat, ne.lng, sw.lat, sw.lng].every(Number.isFinite)) return 25;

  const nw = { lat: ne.lat, lng: sw.lng };
  const se = { lat: sw.lat, lng: ne.lng };
  const maxDistance = Math.max(
    haversineKm(center, ne),
    haversineKm(center, sw),
    haversineKm(center, nw),
    haversineKm(center, se),
  );

  return Math.min(80, Math.max(8, round(maxDistance * 1.15, 3)));
}

function confidenceFor(result) {
  const types = Array.isArray(result.types) ? result.types : [];
  const locationType = result.geometry?.location_type;
  if (types.includes('locality')) return 0.95;
  if (types.includes('administrative_area_level_2')) return 0.88;
  if (locationType === 'GEOMETRIC_CENTER' || locationType === 'APPROXIMATE') return 0.82;
  return 0.75;
}

function buildDetection(row, result) {
  const location = result.geometry?.location;
  const viewport = result.geometry?.viewport;
  const center = {
    lat: Number(location?.lat),
    lng: Number(location?.lng),
  };
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
    throw new Error(`Google no regreso centroide valido para ${row.city_scope_code}`);
  }

  return {
    ...row,
    center_lat: round(center.lat),
    center_lng: round(center.lng),
    radius_km: radiusFromViewport(center, viewport),
    min_lat: viewport?.southwest?.lat == null ? null : round(viewport.southwest.lat),
    max_lat: viewport?.northeast?.lat == null ? null : round(viewport.northeast.lat),
    min_lng: viewport?.southwest?.lng == null ? null : round(viewport.southwest.lng),
    max_lng: viewport?.northeast?.lng == null ? null : round(viewport.northeast.lng),
    confidence: confidenceFor(result),
    source_type: 'google_geocode',
    source_ref: String(result.place_id || result.formatted_address || '').slice(0, 240),
  };
}

async function fetchCatalogCities(pool) {
  const result = await pool.request()
    .input('cityCode', sql.NVarChar(64), onlyCityCode)
    .input('zoneCode', sql.NVarChar(64), onlyZoneCode)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit)
        city.scope_code AS city_scope_code,
        city.city_code,
        city.scope_label AS city_label,
        zone.scope_code AS zone_scope_code,
        zone.zone_code,
        zone.scope_label AS zone_label,
        country.scope_code AS country_scope_code,
        country.country_code
      FROM antojados_core.geo_scope_catalog AS city
      INNER JOIN antojados_core.geo_scope_catalog AS zone
        ON zone.scope_code = city.parent_scope_code
       AND zone.status = N'active'
      INNER JOIN antojados_core.geo_scope_catalog AS country
        ON country.scope_code = zone.parent_scope_code
       AND country.status = N'active'
      LEFT JOIN antojados_core.geo_scope_detection_map AS detection
        ON detection.city_scope_code = city.scope_code
       AND detection.status = N'active'
      WHERE city.status = N'active'
        AND city.scope_level = N'ciudad'
        AND country.scope_code = N'MX_52'
        AND (@cityCode IS NULL OR city.scope_code = @cityCode OR city.city_code = @cityCode)
        AND (@zoneCode IS NULL OR zone.scope_code = @zoneCode OR zone.zone_code = @zoneCode)
        AND (@force = 1 OR detection.detection_id IS NULL)
      ORDER BY city.scope_label, city.scope_code;
    `.replace('@force', force ? '1' : '0'));

  return result.recordset;
}

async function geocodeCity(row) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('Falta GOOGLE_PLACES_API_KEY en el entorno remoto.');
  }

  const query = buildGoogleCityQuery(row);
  const geocodeParams = new URLSearchParams({
    address: query,
    components: 'country:MX',
    language: 'es',
    key: apiKey,
  });
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?${geocodeParams.toString()}`;
  const response = await fetch(geocodeUrl);
  if (!response.ok) {
    throw new Error(`Google Geocoding HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.status === 'ZERO_RESULTS') return null;
  if (payload.status === 'REQUEST_DENIED') {
    return searchGooglePlaceCity(row, query);
  }
  if (payload.status !== 'OK') {
    throw new Error(`Google Geocoding status ${payload.status}${payload.error_message ? `: ${payload.error_message}` : ''}`);
  }

  return Array.isArray(payload.results) && payload.results.length > 0 ? payload.results[0] : null;
}

function buildGoogleCityQuery(row) {
  if (row.zone_scope_code === 'NUL_290') {
    return `${row.city_label}, Tlaxcala, Mexico`;
  }

  return `${row.city_label}, ${row.zone_label}, Mexico`;
}

async function searchGooglePlaceCity(row, query) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const params = new URLSearchParams({
    query,
    language: 'es',
    region: 'mx',
    key: apiKey,
  });
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Places Text Search HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.status === 'ZERO_RESULTS') return null;
  if (payload.status !== 'OK') {
    throw new Error(`Google Places Text Search status ${payload.status}${payload.error_message ? `: ${payload.error_message}` : ''}`);
  }

  const result = Array.isArray(payload.results) && payload.results.length > 0 ? payload.results[0] : null;
  if (!result) return null;
  return {
    ...result,
    source_type_override: 'google_geocode',
  };
}

async function upsertDetection(pool, row) {
  await pool.request()
    .input('cityScopeCode', sql.NVarChar(64), row.city_scope_code)
    .input('cityCode', sql.NVarChar(60), row.city_code)
    .input('cityLabel', sql.NVarChar(240), row.city_label)
    .input('zoneScopeCode', sql.NVarChar(64), row.zone_scope_code)
    .input('zoneCode', sql.NVarChar(60), row.zone_code)
    .input('zoneLabel', sql.NVarChar(240), row.zone_label)
    .input('countryScopeCode', sql.NVarChar(64), row.country_scope_code || 'MX_52')
    .input('countryCode', sql.NVarChar(20), row.country_code || 'MX')
    .input('centerLat', sql.Decimal(9, 6), row.center_lat)
    .input('centerLng', sql.Decimal(9, 6), row.center_lng)
    .input('radiusKm', sql.Decimal(8, 3), row.radius_km)
    .input('minLat', sql.Decimal(9, 6), row.min_lat)
    .input('maxLat', sql.Decimal(9, 6), row.max_lat)
    .input('minLng', sql.Decimal(9, 6), row.min_lng)
    .input('maxLng', sql.Decimal(9, 6), row.max_lng)
    .input('confidence', sql.Decimal(5, 4), row.confidence)
    .input('sourceType', sql.NVarChar(40), row.source_type)
    .input('sourceRef', sql.NVarChar(240), row.source_ref)
    .query(`
      MERGE antojados_core.geo_scope_detection_map AS tgt
      USING (
        SELECT
          @cityScopeCode AS city_scope_code,
          @cityCode AS city_code,
          @cityLabel AS city_label,
          @zoneScopeCode AS zone_scope_code,
          @zoneCode AS zone_code,
          @zoneLabel AS zone_label,
          @countryScopeCode AS country_scope_code,
          @countryCode AS country_code,
          @centerLat AS center_lat,
          @centerLng AS center_lng,
          @radiusKm AS radius_km,
          @minLat AS min_lat,
          @maxLat AS max_lat,
          @minLng AS min_lng,
          @maxLng AS max_lng,
          @confidence AS confidence,
          @sourceType AS source_type,
          @sourceRef AS source_ref
      ) AS src
      ON tgt.city_scope_code = src.city_scope_code
      WHEN MATCHED THEN UPDATE SET
        city_code = src.city_code,
        city_label = src.city_label,
        zone_scope_code = src.zone_scope_code,
        zone_code = src.zone_code,
        zone_label = src.zone_label,
        country_scope_code = src.country_scope_code,
        country_code = src.country_code,
        center_lat = src.center_lat,
        center_lng = src.center_lng,
        radius_km = src.radius_km,
        min_lat = src.min_lat,
        max_lat = src.max_lat,
        min_lng = src.min_lng,
        max_lng = src.max_lng,
        priority = 100,
        confidence = src.confidence,
        source_type = src.source_type,
        source_ref = src.source_ref,
        status = N'active',
        updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (city_scope_code, city_code, city_label, zone_scope_code, zone_code, zone_label,
         country_scope_code, country_code, center_lat, center_lng, radius_km,
         min_lat, max_lat, min_lng, max_lng, priority, confidence, source_type, source_ref, status)
      VALUES
        (src.city_scope_code, src.city_code, src.city_label, src.zone_scope_code, src.zone_code, src.zone_label,
         src.country_scope_code, src.country_code, src.center_lat, src.center_lng, src.radius_km,
         src.min_lat, src.max_lat, src.min_lng, src.max_lng, 100, src.confidence, src.source_type, src.source_ref, N'active');
    `);
}

async function main() {
  const config = getConfig();
  if (!config.server || !config.database || !config.user) {
    throw new Error('Faltan variables GT_ANTOJADOS_* para conectar SQL.');
  }

  console.log(JSON.stringify({
    job: 'populate-geo-scope-detection-map-google',
    mode: dryRun ? 'dry-run' : 'apply',
    force,
    limit,
    city: onlyCityCode,
    zone: onlyZoneCode,
    googleGeocodingEnabled: Boolean(process.env.GOOGLE_PLACES_API_KEY),
  }, null, 2));

  const pool = await sql.connect(config);
  const summary = { candidates: 0, geocoded: 0, applied: 0, zeroResults: 0, errors: 0 };

  try {
    const cities = await fetchCatalogCities(pool);
    summary.candidates = cities.length;

    for (const city of cities) {
      try {
        const result = await geocodeCity(city);
        if (!result) {
          summary.zeroResults += 1;
          console.log(JSON.stringify({ city: city.city_scope_code, status: 'zero_results' }));
          continue;
        }

        const detection = buildDetection(city, result);
        summary.geocoded += 1;
        console.log(JSON.stringify({
          city_scope_code: detection.city_scope_code,
          city_label: detection.city_label,
          zone_scope_code: detection.zone_scope_code,
          center_lat: detection.center_lat,
          center_lng: detection.center_lng,
          radius_km: detection.radius_km,
          confidence: detection.confidence,
          source_ref: detection.source_ref,
          mode: dryRun ? 'dry-run' : 'apply',
        }));

        if (!dryRun) {
          await upsertDetection(pool, detection);
          summary.applied += 1;
        }
      } catch (error) {
        summary.errors += 1;
        console.error(JSON.stringify({
          city_scope_code: city.city_scope_code,
          city_label: city.city_label,
          error: error.message,
        }));
      }

      if (delayMs > 0) await sleep(delayMs);
    }
  } finally {
    await pool.close();
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
