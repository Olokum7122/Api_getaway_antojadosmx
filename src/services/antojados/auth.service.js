'use strict';
/**
 * auth.service.js — Servicio de Autenticación y Usuarios
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Autenticación (Auth)
 * RESPONSABLE:  Orquestar llamadas a authResolver con mapeo/validación
 *               de datos a través de authMapper.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace authResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * FUNCIONES:
 *   registerUser, registerEmployeeWithInvite, loginUser, getProfile,
 *   updateProfile, requestPasswordRecovery, verifyPasswordRecoveryCode,
 *   resetPasswordWithRecovery, setExplorerStatus, listExplorers,
 *   linkExplorerAssociation, listExplorerAssociations, getExplorerActivity,
 *   updateExplorerAssociation, listExplorersActivity
 *
 * REFERENCIAS:
 *   - authResolver.js, authMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const authResolver = require('./authResolver');
const { mapLoginUser, mapProfile } = require('./authMapper');

async function registerUser(payload) {
  return authResolver.registerUser(payload);
}

async function registerEmployeeWithInvite(payload) {
  return authResolver.registerEmployeeWithInvite(payload);
}

async function loginUser(payload) {
  const row = await authResolver.loginUser(payload);
  return row ? mapLoginUser(row) : null;
}

async function getProfile(user_id) {
  const row = await authResolver.getProfile(user_id);
  return row ? mapProfile(row) : null;
}

async function updateProfile(user_id, payload) {
  return authResolver.updateProfile(user_id, payload);
}

async function requestPasswordRecovery(payload) {
  return authResolver.requestPasswordRecovery(payload);
}

async function verifyPasswordRecoveryCode(payload) {
  return authResolver.verifyPasswordRecoveryCode(payload);
}

async function resetPasswordWithRecovery(payload) {
  return authResolver.resetPasswordWithRecovery(payload);
}

async function setExplorerStatus(user_id, payload) {
  return authResolver.setExplorerStatus(user_id, payload);
}

async function listExplorers(payload) {
  return authResolver.listExplorers(payload);
}

async function linkExplorerAssociation(user_id, payload) {
  return authResolver.linkExplorerAssociation(user_id, payload);
}

async function listExplorerAssociations(user_id, payload) {
  return authResolver.listExplorerAssociations(user_id, payload);
}

async function getExplorerActivity(user_id, payload) {
  return authResolver.getExplorerActivity(user_id, payload);
}

async function updateExplorerAssociation(user_id, association_id, payload) {
  return authResolver.updateExplorerAssociation(user_id, association_id, payload);
}

async function listExplorersActivity(payload) {
  return authResolver.listExplorersActivity(payload);
}

module.exports = {
  registerUser,
  registerEmployeeWithInvite,
  loginUser,
  getProfile,
  updateProfile,
  requestPasswordRecovery,
  verifyPasswordRecoveryCode,
  resetPasswordWithRecovery,
  setExplorerStatus,
  listExplorers,
  linkExplorerAssociation,
  listExplorerAssociations,
  getExplorerActivity,
  updateExplorerAssociation,
  listExplorersActivity,
};
