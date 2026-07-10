'use strict';
/**
 * instancias.service.js — Servicio de Instancias del Sistema
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Instancias del Sistema (sys_instancia)
 * RESPONSABLE:  Obtener información de instancias de usuario/sponsor
 *               con validación vía instanciasMapper.
 *
 * FUNCIONES:
 *   getInstanceInfo → obtener info de instancia por user_id + instance_type
 *
 * REFERENCIAS:
 *   - instanciasResolver.js, instanciasMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const instanciasResolver = require('./instanciasResolver');
const { mapInstanceInfo } = require('./instanciasMapper');

async function getInstanceInfo(payload) {
  return mapInstanceInfo(await instanciasResolver.getInstanceInfo(payload));
}

module.exports = { getInstanceInfo };
