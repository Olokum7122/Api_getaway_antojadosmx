'use strict';

/**
 * engineClient.js — Cliente HTTP para Media Engine V3
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Media Engine — Procesamiento de imágenes y videos
 * RESPONSABLE:  Comunicación HTTP con el servidor del Media Engine
 *
 * NO HACE:
 *   - No escribe en BD (lo hace el Media Engine internamente)
 *   - No procesa archivos (lo hace el Worker del Engine)
 *   - No sabe de posts ni sponsors (solo pasa parámetros)
 *
 * FLUJO:
 *   createMediaRequest()     → POST /api/media/requests
 *                              Crea intake (media_request) con estado 'received'
 *
 *   uploadOriginal()         → POST /api/media/:mediaId/original
 *                              Sube archivo binario → multipart/form-data
 *                              El Engine mueve a /media/{year}/{month}/{mediaId}/
 *
 *   getReadyPayload()        → GET /api/media/:mediaId/ready-payload
 *                              Devuelve { thumb_url, feed_url, full_url, ... }
 *                              null si no existe o no está ready
 *
 *   getMediaInfo()           → GET /api/media/:mediaId
 *                              Devuelve info completa del media request
 *
 * ENDPOINTS DEL ENGINE:
 *   POST   /api/media/requests
 *   POST   /api/media/:mediaId/original
 *   GET    /api/media/:mediaId/ready-payload
 *   GET    /api/media/:mediaId
 *   POST   /api/media/:mediaId/cancel
 *   POST   /api/media/:mediaId/rights-origin
 *
 * ENGINE CONFIG:
 *   ME_MEDIA_BASE_URL (default: https://media.antojadosmx.mx)
 *
 * MODELO DE DATOS: media-engine/docs/ (tablas me.media_request, me.media_original, me.media_variant)
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ENGINE_BASE = process.env.ME_MEDIA_BASE_URL || 'https://media.antojadosmx.mx';

async function createMediaRequest({ sourceApp, sourceActorType, sourceActorId, targetContext, mediaType, externalContextId, clientReferenceId, processingProfileCode, watermarkProfileCode }) {
  const url = `${ENGINE_BASE}/api/media/requests`;
  const body = {
    sourceApp: sourceApp || 'antojados',
    sourceActorType: sourceActorType || 'user',
    sourceActorId,
    targetContext: targetContext || 'post',
    mediaType: mediaType || 'image',
    externalContextId: externalContextId || null,
    clientReferenceId: clientReferenceId || null,
    processingProfileCode: processingProfileCode || null,
    watermarkProfileCode: watermarkProfileCode || null,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[engineClient] createMediaRequest failed (${res.status}): ${errText}`);
  }

  return res.json(); // { mediaId, status, mediaType, createdAt }
}

async function registerRightsOrigin(mediaId, { originType, originPlatform, ownershipType, rightsStatus, isDemoContent, allowEngineWatermark } = {}) {
  const url = `${ENGINE_BASE}/api/media/${mediaId}/rights-origin`;

  const body = {
    originType: originType || 'unknown',
    originPlatform: originPlatform || null,
    ownershipType: ownershipType || 'unknown',
    rightsStatus: rightsStatus || 'declared',
    isDemoContent: isDemoContent || false,
    allowEngineWatermark: allowEngineWatermark !== false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[engineClient] registerRightsOrigin failed (${res.status}): ${errText}`);
  }

  return res.json(); // { mediaId, originType, rightsStatus, updatedAt }
}

async function uploadOriginal(mediaId, fileBuffer, fileName, mimeType) {
  const url = `${ENGINE_BASE}/api/media/${mediaId}/original`;

  // Node 24 tiene FormData nativo (sin import)
  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  form.append('file', blob, fileName);

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[engineClient] uploadOriginal failed (${res.status}): ${errText}`);
  }

  return res.json(); // { mediaId, status, originalUrl, sizeBytes, mimeType, sha256Hash }
}

async function getReadyPayload(mediaId) {
  const url = `${ENGINE_BASE}/api/media/${mediaId}/ready-payload`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`[engineClient] getReadyPayload failed (${res.status})`);
  }

  return res.json();
}

async function getMediaInfo(mediaId) {
  const url = `${ENGINE_BASE}/api/media/${mediaId}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`[engineClient] getMediaInfo failed (${res.status})`);
  }

  return res.json();
}

module.exports = {
  createMediaRequest,
  registerRightsOrigin,
  uploadOriginal,
  getReadyPayload,
  getMediaInfo,
};
