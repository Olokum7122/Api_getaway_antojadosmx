'use strict';
/**
 * equipo.service.js — Servicio de Equipo / Empleados (Biz Tenants)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Equipo de Negocio (biz_tenants)
 * RESPONSABLE:  Orquestar llamadas a equipoResolver con mapeo/validación
 *               de datos a través de equipoMapper.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace equipoResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * FUNCIONES:
 *   getTenantByUserId, listPerfiles, listUsuarios, updateUsuarioPerfil,
 *   revocarUsuario, generarInvitacion, updateInvitacion, deleteInvitacion,
 *   listInvitacionesPendientes, getInvitacion, redimirInvitacion,
 *   getAsignaciones, setAsignaciones, seedAsignaciones, transferirAdminGeneral
 *
 * REFERENCIAS:
 *   - equipoResolver.js, equipoMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const resolver = require('./equipoResolver');
const mapper = require('./equipoMapper');

async function getTenantByUserId(user_id) {
  const row = await resolver.getTenantByUserId(user_id);
  return row ? mapper.mapTenantContext(row) : null;
}

async function listPerfiles(instance_id) {
  return mapper.mapList(await resolver.listPerfiles(instance_id), mapper.mapPerfil);
}

async function listUsuarios(instance_id) {
  return mapper.mapList(await resolver.listUsuarios(instance_id), mapper.mapUsuario);
}

async function updateUsuarioPerfil(tenant_user_id, profile_id) {
  return resolver.updateUsuarioPerfil(tenant_user_id, profile_id);
}

async function revocarUsuario(tenant_user_id) {
  return resolver.revocarUsuario(tenant_user_id);
}

async function generarInvitacion(input) {
  return mapper.mapInvitacion(await resolver.generarInvitacion(input));
}

async function updateInvitacion(id, payload) {
  return resolver.updateInvitacion(id, payload);
}

async function deleteInvitacion(id) {
  return resolver.deleteInvitacion(id);
}

async function listInvitacionesPendientes(instance_id) {
  return mapper.mapList(await resolver.listInvitacionesPendientes(instance_id), mapper.mapInvitacion);
}

async function getInvitacion(invite_code) {
  const row = await resolver.getInvitacion(invite_code);
  return row ? mapper.mapInvitacion(row) : null;
}

async function redimirInvitacion(payload) {
  return resolver.redimirInvitacion(payload);
}

async function getAsignaciones(tenant_user_id) {
  return mapper.mapList(await resolver.getAsignaciones(tenant_user_id), mapper.mapAsignacion);
}

async function setAsignaciones(tenant_user_id, details) {
  return mapper.mapInsertedResult(await resolver.setAsignaciones(tenant_user_id, details));
}

async function seedAsignaciones(tenant_user_id, force = false) {
  return mapper.mapSeedResult(await resolver.seedAsignaciones(tenant_user_id, force));
}

async function transferirAdminGeneral(payload) {
  return mapper.mapTransferResult(await resolver.transferirAdminGeneral(payload));
}

module.exports = {
  getTenantByUserId,
  listPerfiles,
  listUsuarios,
  updateUsuarioPerfil,
  revocarUsuario,
  generarInvitacion,
  updateInvitacion,
  deleteInvitacion,
  listInvitacionesPendientes,
  getInvitacion,
  redimirInvitacion,
  getAsignaciones,
  setAsignaciones,
  seedAsignaciones,
  transferirAdminGeneral,
};
