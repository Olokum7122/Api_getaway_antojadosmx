'use strict';
/**
 * sync.service.js — Servicio de Sincronización Offline
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Sincronización Offline (Outbox SQLite)
 * RESPONSABLE:  Orquestar ingestión de eventos offline enviados desde
 *               el cliente (app) hacia la base de datos de integración.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace syncResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * FUNCIONES:
 *   syncEvents → ingesta batch de eventos con dedup por idempotency_key
 *
 * REFERENCIAS:
 *   - syncResolver.js, syncMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const syncResolver = require('./syncResolver');
const { mapSyncEventsResult } = require('./syncMapper');

async function syncEvents(payload) {
  return mapSyncEventsResult(await syncResolver.syncEvents(payload));
}

module.exports = { syncEvents };
