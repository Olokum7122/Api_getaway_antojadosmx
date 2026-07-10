'use strict';
/**
 * instanciasMapper.js — Mapper de Instancias del Sistema
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Instancias del Sistema (sys_instancia)
 * RESPONSABLE:  Validar que el resultado de instancia contenga instance_id.
 *
 * MAPEADOR:
 *   mapInstanceInfo → valida instance_id presente
 *
 * REFERENCIAS:
 *   - instanciasResolver.js, instancias.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function mapInstanceInfo(raw) {
  if (raw == null) return null;
  if (!raw?.instance_id) {
    throw new Error(`instanciasMapper.mapInstanceInfo: instance_id faltante — ${JSON.stringify(raw)}`);
  }
  return raw;
}

module.exports = { mapInstanceInfo };