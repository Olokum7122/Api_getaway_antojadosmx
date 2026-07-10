'use strict';

const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function mapInstance(row) {
  if (!row?.instance_id) throw new Error('mapInstance: instance_id faltante');
  return {
    instance_id: row.instance_id,
    cuenta_id: row.cuenta_id,
    instance_type: row.instance_type,
    sponsor_biz_id: row[SPONSOR_BIZ_KEY] ?? null,
    root_location_id: row.root_location_id ?? null,
    status: row.status,
    snapshot_hash: row.snapshot_hash ?? null,
    cascade_synced_at: row.cascade_synced_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function mapDimensionLocation(row) {
  if (!row?.location_id) throw new Error('mapDimensionLocation: location_id faltante');
  return {
    location_id: row.location_id,
    instance_id: row.instance_id,
    root_location_id: row.root_location_id ?? null,
    parent_location_id: row.parent_location_id ?? null,
    dimension_id: row.dimension_id ?? null,
    node_kind: row.node_kind ?? null,
    node_level: row.node_level ?? null,
    code: row.code ?? null,
    label: row.label ?? null,
    module_code: row.module_code ?? null,
    area_code: row.area_code ?? null,
    component_code: row.component_code ?? null,
    visible: row.visible,
    enabled: row.enabled,
    meta_json: row.meta_json ?? null,
    sort_order: row.sort_order ?? null,
    is_leaf: row.is_leaf ?? null,
    materialized_at: row.materialized_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function mapSubDimensionLocation(row) {
  if (!row?.id) throw new Error('mapSubDimensionLocation: id faltante');
  return {
    id: row.id,
    instance_id: row.instance_id,
    root_location_id: row.root_location_id ?? null,
    sub_dimension_id: row.sub_dimension_id,
    sub_code: row.sub_code,
    sub_name: row.sub_name ?? null,
    sub_type: row.sub_type ?? null,
    visible: row.visible,
    enabled: row.enabled,
    sort_order: row.sort_order ?? null,
    materialized_at: row.materialized_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function mapReusableSummary(row) {
  if (!row?.reusable_code) throw new Error('mapReusableSummary: reusable_code faltante');
  return {
    reusable_code: row.reusable_code,
    scope_type: row.scope_type,
    root_reusable_location_id: row.root_reusable_location_id ?? null,
    dimension_node_count: row.dimension_node_count ?? null,
    component_node_count: row.component_node_count ?? null,
    sub_dimension_node_count: row.sub_dimension_node_count ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function mapReusableDimensionLocation(row) {
  if (!row?.location_id) throw new Error('mapReusableDimensionLocation: location_id faltante');
  return {
    location_id: row.location_id,
    reusable_code: row.reusable_code,
    scope_type: row.scope_type,
    root_location_id: row.root_location_id ?? null,
    parent_location_id: row.parent_location_id ?? null,
    dimension_id: row.dimension_id ?? null,
    node_kind: row.node_kind ?? null,
    node_level: row.node_level ?? null,
    code: row.code ?? null,
    label: row.label ?? null,
    module_code: row.module_code ?? null,
    area_code: row.area_code ?? null,
    component_code: row.component_code ?? null,
    visible: row.visible,
    enabled: row.enabled,
    meta_json: row.meta_json ?? null,
    sort_order: row.sort_order ?? null,
    is_leaf: row.is_leaf ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function mapReusableSubDimensionLocation(row) {
  if (!row?.id) throw new Error('mapReusableSubDimensionLocation: id faltante');
  return {
    id: row.id,
    reusable_code: row.reusable_code,
    scope_type: row.scope_type,
    sub_dimension_id: row.sub_dimension_id,
    sub_code: row.sub_code,
    sub_name: row.sub_name ?? null,
    sub_type: row.sub_type ?? null,
    visible: row.visible,
    enabled: row.enabled,
    sort_order: row.sort_order ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function mapInstanceCascade(raw, helpers) {
  if (raw == null) return null;
  if (!raw?.instance) throw new Error('mapInstanceCascade: instance faltante');
  if (!Array.isArray(raw.dimension_locations)) throw new Error('mapInstanceCascade: dimension_locations no es array');
  if (!Array.isArray(raw.sub_dimension_locations)) throw new Error('mapInstanceCascade: sub_dimension_locations no es array');
  return {
    instance: helpers.mapInstance(raw.instance),
    dimension_locations: raw.dimension_locations.map(helpers.mapDimensionLocation),
    sub_dimension_locations: raw.sub_dimension_locations.map(helpers.mapSubDimensionLocation),
  };
}

function mapReusableCascade(raw, helpers) {
  if (raw == null) return null;
  if (!raw?.reusable) throw new Error('mapReusableCascade: reusable faltante');
  if (!Array.isArray(raw.dimension_locations)) throw new Error('mapReusableCascade: dimension_locations no es array');
  if (!Array.isArray(raw.sub_dimension_locations)) throw new Error('mapReusableCascade: sub_dimension_locations no es array');
  return {
    reusable: helpers.mapReusableSummary(raw.reusable),
    dimension_locations: raw.dimension_locations.map(helpers.mapReusableDimensionLocation),
    sub_dimension_locations: raw.sub_dimension_locations.map(helpers.mapReusableSubDimensionLocation),
  };
}

function mapRebuildInstanceCascade(raw) {
  if (raw == null) return null;
  if (typeof raw.ok !== 'boolean') throw new Error('mapRebuildInstanceCascade: ok faltante');
  return raw;
}

function mapRebuildReusableCascade(raw) {
  if (raw == null) return null;
  if (!raw?.reusable_code && !raw?.instance_id) {
    throw new Error('mapRebuildReusableCascade: payload de respuesta incompleto');
  }
  return raw;
}

module.exports = {
  mapInstance,
  mapDimensionLocation,
  mapSubDimensionLocation,
  mapReusableSummary,
  mapReusableDimensionLocation,
  mapReusableSubDimensionLocation,
  mapInstanceCascade,
  mapReusableCascade,
  mapRebuildInstanceCascade,
  mapRebuildReusableCascade,
};