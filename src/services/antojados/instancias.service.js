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

async function transitarInstancia(payload) {
  const { instance_id, status, actor_user_id } = payload;
  const result = await instanciasResolver.transitarInstanciaSP({ instance_id, status });
  // Notificación best-effort
  try {
    const { _emitEvent } = require('./_shared');
    await _emitEvent({
      user_id: actor_user_id || 'system',
      event_type: 'instance_status_changed',
      payload: { instance_id, status, previous: result.previous_status },
    });
  } catch (_) { /* best-effort */ }
  return { instance_id, status };
}

module.exports = { getInstanceInfo, transitarInstancia };
