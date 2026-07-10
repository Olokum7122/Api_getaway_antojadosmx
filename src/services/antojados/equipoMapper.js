'use strict';
/**
 * equipoMapper.js — Mappers de Equipo / Empleados (Biz Tenants)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Equipo de Negocio (biz_tenants)
 * RESPONSABLE:  Transformar/validar datos de tenant context, perfiles,
 *               usuarios, invitaciones, asignaciones y resultados de
 *               operaciones de equipo.
 *
 * NO HACE:
 *   - No consulta BD (lo hacen los resolvers)
 *   - No contiene lógica de negocio (solo validación de presencia)
 *
 * MAPEADORES:
 *   mapTenantContext   → valida instance_id + business_name
 *   mapPerfil          → valida id + name
 *   mapUsuario         → valida tenant_user_id + user_id
 *   mapInvitacion      → valida id
 *   mapAsignacion      → valida location_id + component_code
 *   mapInsertedResult  → { inserted }
 *   mapSeedResult      → { seeded }
 *   mapTransferResult  → { nuevo_user_id, profile_id, updated_rows }
 *   mapList            → wrapper genérico para arrays
 *
 * REFERENCIAS:
 *   - equipoResolver.js, equipo.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function mapTenantContext(row) {
  if (!row) throw new Error('mapTenantContext: row faltante');
  if (!row.instance_id) throw new Error('mapTenantContext: instance_id faltante');
  if (!row.business_name) throw new Error('mapTenantContext: business_name faltante');
  return {
    instance_id: row.instance_id,
    business_name: row.business_name,
    tenant_status: row.tenant_status,
    tenant_user_id: row.tenant_user_id ?? null,
    profile_id: row.profile_id ?? null,
    profile_name: row.profile_name ?? null,
    profile_type: row.profile_type ?? null,
    owner_user_id: row.owner_user_id ?? null,
    is_owner: Boolean(row.is_owner),
  };
}

function mapPerfil(row) {
  if (!row.id) throw new Error('mapPerfil: id faltante');
  if (!row.name) throw new Error(`mapPerfil: name faltante en ${row.id}`);
  return {
    id: row.id,
    name: row.name,
    profile_type: row.profile_type,
    is_system: row.is_system,
    created_at: row.created_at,
  };
}

function mapUsuario(row) {
  if (!row.tenant_user_id) throw new Error('mapUsuario: tenant_user_id faltante');
  if (!row.user_id) throw new Error(`mapUsuario: user_id faltante en ${row.tenant_user_id}`);
  return {
    tenant_user_id: row.tenant_user_id,
    instance_id: row.instance_id ?? null,
    user_id: row.user_id,
    profile_id: row.profile_id ?? null,
    profile_name: row.profile_name ?? null,
    profile_type: row.profile_type ?? null,
    display_name: row.display_name ?? null,
    username: row.username ?? null,
    whatsapp_number: row.whatsapp_number ?? null,
    avatar_url: row.avatar_url ?? null,
    status: row.status,
    invited_by: row.invited_by ?? null,
    created_at: row.created_at,
    is_owner: Boolean(row.is_owner),
  };
}

function mapInvitacion(row) {
  if (!row || !row.id) throw new Error('mapInvitacion: id faltante');
  return {
    id: row.id,
    instance_id: row.instance_id ?? null,
    invite_code: row.invite_code ?? null,
    invitee_email: row.invitee_email ?? null,
    invitee_phone_e164: row.invitee_phone_e164 ?? null,
    channel: row.channel ?? null,
    profile_id: row.profile_id ?? null,
    profile_name: row.profile_name ?? null,
    profile_type: row.profile_type ?? null,
    status: row.status ?? null,
    expires_at: row.expires_at ?? null,
    created_by: row.created_by ?? null,
    business_name: row.business_name ?? null,
  };
}

function mapAsignacion(row) {
  if (!row || !row.location_id) throw new Error('mapAsignacion: location_id faltante');
  if (!row.component_code) throw new Error(`mapAsignacion: component_code faltante en location ${row.location_id}`);
  return {
    location_id: row.location_id,
    instance_id: row.instance_id ?? null,
    node_level: row.node_level ?? null,
    node_kind: row.node_kind ?? null,
    code: row.code ?? null,
    component_code: row.component_code,
    label: row.label ?? null,
    sort_order: row.sort_order ?? null,
    visible: Boolean(row.visible),
    puede_leer: Boolean(row.puede_leer),
    puede_editar: Boolean(row.puede_editar),
    tenant_user_id: row.tenant_user_id ?? null,
    tenant_instance_id: row.tenant_instance_id ?? null,
  };
}

function mapInsertedResult(row) {
  return {
    inserted: row?.inserted ?? 0,
  };
}

function mapSeedResult(row) {
  return {
    seeded: row?.seeded ?? 0,
  };
}

function mapTransferResult(row) {
  if (!row) return null;
  return {
    nuevo_user_id: row.nuevo_user_id ?? null,
    profile_id: row.profile_id ?? null,
    updated_rows: row.updated_rows ?? null,
  };
}

function mapList(rows, mapper) {
  if (!Array.isArray(rows)) throw new Error('mapList: rows no es array');
  return rows.map(mapper);
}

module.exports = {
  mapTenantContext,
  mapPerfil,
  mapUsuario,
  mapInvitacion,
  mapAsignacion,
  mapInsertedResult,
  mapSeedResult,
  mapTransferResult,
  mapList,
};