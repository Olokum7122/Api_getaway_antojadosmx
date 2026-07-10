'use strict';
/**
 * authMapper.js — Mappers de Autenticación y Usuarios
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Autenticación (Auth)
 * RESPONSABLE:  Transformar/validar datos de login y perfil de usuario.
 *
 * MAPEADORES:
 *   mapLoginUser → valida user_id presente en login
 *   mapProfile   → valida user_id presente en perfil
 *
 * REFERENCIAS:
 *   - authResolver.js, auth.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function mapLoginUser(raw) {
  if (!raw?.user_id) {
    throw new Error(`authMapper.mapLoginUser: user_id faltante — ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapProfile(raw) {
  if (!raw?.user_id) {
    throw new Error(`authMapper.mapProfile: user_id faltante — ${JSON.stringify(raw)}`);
  }
  return raw;
}

module.exports = { mapLoginUser, mapProfile };