'use strict';

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name}: se esperaba array`);
  }
  return value;
}

function mapTemplateSummary(row) {
  if (!row?.template_code) throw new Error('mapTemplateSummary: template_code faltante');
  return {
    template_code: row.template_code,
    scope_type: row.scope_type,
    dimension_node_count: row.dimension_node_count,
    sub_dimension_count: row.sub_dimension_count,
    is_active_count: row.is_active_count,
    updated_at: row.updated_at ?? null,
  };
}

function mapTemplateSummaryList(rows) {
  return assertArray(rows, 'gt-templatesMapper.mapTemplateSummaryList').map(mapTemplateSummary);
}

function mapTemplateDimensionLocation(row) {
  if (!row?.template_location_id) throw new Error('mapTemplateDimensionLocation: template_location_id faltante');
  return {
    template_location_id: row.template_location_id,
    template_code: row.template_code,
    scope_type: row.scope_type,
    dimension_id: row.dimension_id,
    component_code: row.component_code,
    dimension_code: row.dimension_code ?? null,
    dimension_name: row.dimension_name ?? null,
    dimension_type: row.dimension_type ?? null,
    applies_to: row.applies_to ?? null,
    visible: row.visible,
    enabled: row.enabled,
    sort_order: row.sort_order,
    meta_json: row.meta_json ?? null,
    is_active: row.is_active,
    updated_at: row.updated_at,
  };
}

function mapTemplateSubDimensionLocation(row) {
  if (!row?.template_sub_location_id) throw new Error('mapTemplateSubDimensionLocation: template_sub_location_id faltante');
  return {
    template_sub_location_id: row.template_sub_location_id,
    template_code: row.template_code,
    scope_type: row.scope_type,
    sub_dimension_id: row.sub_dimension_id,
    sub_code: row.sub_code ?? null,
    sub_name: row.sub_name ?? null,
    sub_type: row.sub_type ?? null,
    parent_dimension_id: row.parent_dimension_id ?? null,
    enabled: row.enabled,
    sort_order: row.sort_order,
    meta_json: row.meta_json ?? null,
    is_active: row.is_active,
    updated_at: row.updated_at,
  };
}

function mapTemplateDetail(raw) {
  if (raw == null) return null;
  if (!raw?.template_code) throw new Error('mapTemplateDetail: template_code faltante');
  return {
    template_code: raw.template_code,
    scope_type: raw.scope_type,
    dimension_locations: assertArray(raw.dimension_locations, 'gt-templatesMapper.mapTemplateDetail.dimension_locations').map(mapTemplateDimensionLocation),
    sub_dimension_locations: assertArray(raw.sub_dimension_locations, 'gt-templatesMapper.mapTemplateDetail.sub_dimension_locations').map(mapTemplateSubDimensionLocation),
  };
}

function mapTemplateRebuildResult(raw) {
  if (raw == null) return null;
  if (!raw.dimensions || !raw.sub_dimensions) throw new Error('mapTemplateRebuildResult: payload incompleto');
  return raw;
}

function mapTemplateUpdateResult(raw) {
  if (raw == null) return null;
  if (!raw.updated) throw new Error('mapTemplateUpdateResult: updated faltante');
  return raw;
}

module.exports = {
  mapTemplateSummaryList,
  mapTemplateDetail,
  mapTemplateRebuildResult,
  mapTemplateUpdateResult,
};