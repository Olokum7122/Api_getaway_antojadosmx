'use strict';
/**
 * syncMapper.js — Mapper de Sincronización Offline
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Sincronización Offline (Outbox SQLite)
 * RESPONSABLE:  Validar payload de resultado de sync de eventos.
 *
 * MAPEADOR:
 *   mapSyncEventsResult → valida arrays accepted, duplicate, error presentes
 *
 * REFERENCIAS:
 *   - syncResolver.js, sync.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function mapSyncEventsResult(raw) {
  if (raw == null) return null;
  if (!Array.isArray(raw.accepted) || !Array.isArray(raw.duplicate) || !Array.isArray(raw.error)) {
    throw new Error('syncMapper.mapSyncEventsResult: payload incompleto');
  }
  return raw;
}

module.exports = { mapSyncEventsResult };