'use strict';
/**
 * places.service.js — Servicio de Lugares (soc_places)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Lugares y Rankings Sociales
 * RESPONSABLE:  Orquestar llamadas a placesResolver con mapeo/validación
 *               de datos a través de placesMapper.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace placesResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * FUNCIONES:
 *   listPlaces, getPlace, createPlace, updatePlace,
 *   getPlacePosts, getPlaceByPublisher, getPlaceRatingsSummary
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md
 *   - placesResolver.js, placesMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const placeResolver = require('./placesResolver');
const {
  mapPlaceRow,
  mapPlaceList,
  mapPlaceDetail,
  mapPlacePosts,
  mapPlaceRatingsSummary,
} = require('./placesMapper');

async function listPlaces({ city_code, category, limit, offset }) {
  const rows = await placeResolver.listPlaces({ city_code, category, limit, offset });
  return mapPlaceList(rows);
}

async function getPlace(id, user_id = null) {
  const row = await placeResolver.getPlace(id, user_id);
  return row ? mapPlaceDetail(row) : null;
}

async function createPlace(payload) {
  return placeResolver.createPlace(payload);
}

async function updatePlace(id, payload) {
  return placeResolver.updatePlace(id, payload);
}

async function getPlacePosts(id, { limit, offset }) {
  const rows = await placeResolver.getPlacePosts(id, { limit, offset });
  return mapPlacePosts(rows);
}

async function getPlaceByPublisher(user_id) {
  const row = await placeResolver.getPlaceByPublisher(user_id);
  return row ? mapPlaceRow(row) : null;
}

async function getPlaceRatingsSummary(id) {
  const row = await placeResolver.getPlaceRatingsSummary(id);
  return row ? mapPlaceRatingsSummary(row) : null;
}

module.exports = {
  listPlaces,
  getPlace,
  createPlace,
  updatePlace,
  getPlacePosts,
  getPlaceByPublisher,
  getPlaceRatingsSummary,
};
