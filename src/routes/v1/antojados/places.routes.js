'use strict';
/**
 * places.routes.js — Rutas de Lugares (soc_places)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Lugares y Rankings Sociales
 * RESPONSABLE:  Exponer endpoints REST para CRUD de lugares,
 *               búsqueda en Google Places, consulta de posts y ratings.
 *
 * ENDPOINTS:
 *   GET    /places/search-gplaces         → buscar en Google Places
 *   GET    /places                        → listar lugares
 *   GET    /places/by-publisher           → lugar por publisher
 *   GET    /places/:id                    → detalle de lugar
 *   POST   /places                        → crear lugar
 *   PATCH  /places/:id                    → actualizar lugar
 *   GET    /places/:id/posts              → posts en lugar
 *   GET    /places/:id/ratings-summary    → resumen de ratings
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md
 *   - places.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/places.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/places/search-gplaces?name=...&city=...
router.get('/places/search-gplaces', async (req, res) => {
  const { name, city } = req.query;
  if (!name || !city)
    return res.status(400).json({ error: 'name y city son requeridos' });
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey)
    return res.status(503).json({ error: 'Google Places no configurado' });
  try {
    const query = encodeURIComponent(`${name} ${city}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const candidates = (data.results || []).slice(0, 5).map(r => ({
      id: r.id,
      name: r.name,
      formatted_address: r.formatted_address,
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    }));
    res.json({ candidates });
  } catch (e) {
    console.error('[places.routes] search-gplaces failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/antojados/places
router.get('/places', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listPlaces({ ...req.query, limit, offset }).then(data => ({ data, page, limit })));
});

// GET /api/v1/antojados/places/by-publisher?user_id=...
router.get('/places/by-publisher', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.getPlaceByPublisher(user_id));
});

// GET /api/v1/antojados/places/:id
router.get('/places/:id', (req, res) => {
  send(res, svc.getPlace(req.params.id, req.query.user_id));
});

// POST /api/v1/antojados/places
router.post('/places', (req, res) => {
  const { id, name, category, city_code, lat, lng } = req.body;
  if (!id || !name || !category || !city_code || lat == null || lng == null)
    return res.status(400).json({ error: 'id, name, category, city_code, lat y lng son requeridos' });
  send(res, svc.createPlace(req.body).then(() => ({ id })), 201);
});

// PATCH /api/v1/antojados/places/:id
router.patch('/places/:id', (req, res) => {
  const allowed = ['name','category','city_code','lat','lng','address','phone','website',
                   'whatsapp','hours_json','description','instagram_handle','facebook_url',
                   'price_range','plan_type','verified','status'];
  const payload = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  if (Object.keys(payload).length === 0)
    return res.status(400).json({ error: 'No se recibió ningún campo actualizable' });
  send(res, svc.updatePlace(req.params.id, payload).then(() => ({ id: req.params.id })));
});

// GET /api/v1/antojados/places/:id/posts
router.get('/places/:id/posts', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.getPlacePosts(req.params.id, { limit, offset }).then(data => ({ data, page, limit })));
});

// GET /api/v1/antojados/places/:id/ratings-summary
router.get('/places/:id/ratings-summary', (req, res) => {
  send(res, svc.getPlaceRatingsSummary(req.params.id));
});

module.exports = router;
