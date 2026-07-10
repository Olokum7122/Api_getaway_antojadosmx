'use strict';
// Router: ZonaD — delivery de patrocinadores
// Montado en: /api/v1/antojados/zonad
//
// Nota sobre autenticación: en fase 1, user_id y id llegan en
// el body/query tal como lo hacen el resto de los endpoints de antojados.js.
// Se delega en el service la validación de pertenencia.

const { Router } = require('express');
const svc = require('../../services/zonad.service');

const router = Router();

function send(res, promise, status = 200) {
  promise
    .then(data => data != null
      ? res.status(status).json(data)
      : res.status(404).json({ error: 'not_found' })
    )
    .catch(e => res.status(e.status || 500).json({ error: e.message }));
}

function parsePage(q) {
  const page  = Math.max(1, parseInt(q.page  || 1,  10));
  const limit = Math.min(100, Math.max(1, parseInt(q.limit || 40, 10)));
  return { page, limit, offset: (page - 1) * limit };
}

// ─── CONFIG ──────────────────────────────────────────────────

// GET /api/v1/antojados/zonad/config
router.get('/config', (_req, res) => {
  send(res, svc.getConfig());
});

// ─── GALERÍA PÚBLICA ─────────────────────────────────────────

// GET /api/v1/antojados/zonad/promos
router.get('/promos', (req, res) => {
  const { limit, offset } = parsePage(req.query);
  const category_tag = req.query.category_tag || null;
  send(res, svc.listPromos({ category_tag, limit, offset }));
});

// GET /api/v1/antojados/zonad/promos/filters
router.get('/promos/filters', (_req, res) => {
  send(res, svc.listPromoFilters());
});

// ─── CATÁLOGO DEL PROVEEDOR ───────────────────────────────────

// GET /api/v1/antojados/zonad/catalog/:id
router.get('/catalog/:id', (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id requerido' });
  send(res, svc.getCatalog(id));
});

// ─── ÓRDENES ─────────────────────────────────────────────────

// POST /api/v1/antojados/zonad/orders
router.post('/orders', (req, res) => {
  const {
    order_id, id, user_id,
    delivery_address, delivery_lat, delivery_lng,
    subtotal, total, payment_method,
    notes, created_at_client, items,
  } = req.body;

  if (!order_id || !id || !user_id || !delivery_address || !subtotal || !total || !created_at_client)
    return res.status(400).json({ error: 'Campos requeridos: order_id, id, user_id, delivery_address, subtotal, total, created_at_client' });

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'items debe ser un array no vacío' });

  send(res, svc.placeOrder({
    order_id, id, user_id,
    delivery_address, delivery_lat, delivery_lng,
    subtotal, total, payment_method,
    notes, created_at_client, items,
  }), 201);
});

// GET /api/v1/antojados/zonad/orders/user/:user_id
router.get('/orders/user/:user_id', (req, res) => {
  const { user_id } = req.params;
  const { limit, offset } = parsePage(req.query);
  send(res, svc.getOrdersByUser(user_id, { limit, offset }));
});

// PATCH /api/v1/antojados/zonad/orders/:id/cancel
router.patch('/orders/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { user_id, reason } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id requerido' });
  send(res, svc.cancelOrder(id, user_id, reason));
});

// ─── PRODUCTOS (PROVEEDOR) ───────────────────────────────────

// POST /api/v1/antojados/zonad/products
router.post('/products', (req, res) => {
  const { id, zonad_product_id, title, price, category_tag } = req.body;
  if (!id || !zonad_product_id || !title || price == null || !category_tag)
    return res.status(400).json({ error: 'id, zonad_product_id, title, price, category_tag son requeridos' });
  send(res, svc.createProduct(id, req.body), 201);
});

// GET /api/v1/antojados/zonad/products?id=xxx
router.get('/products', (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id requerido' });
  send(res, svc.listProducts(id));
});

// PATCH /api/v1/antojados/zonad/products/:id
router.patch('/products/:id', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id requerido en body' });
  send(res, svc.updateProduct(id, req.params.id, req.body));
});

// DELETE /api/v1/antojados/zonad/products/:id
router.delete('/products/:id', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id requerido en body' });
  send(res, svc.deleteProduct(id, req.params.id));
});

// ─── PROMOS (PROVEEDOR) ──────────────────────────────────────

// POST /api/v1/antojados/zonad/promos/business
router.post('/promos/business', (req, res) => {
  const { id, zonad_promo_id, promo_img_url, category_tag } = req.body;
  if (!id || !zonad_promo_id || !promo_img_url || !category_tag)
    return res.status(400).json({ error: 'id, zonad_promo_id, promo_img_url, category_tag son requeridos' });
  send(res, svc.createPromo(id, req.body), 201);
});

// GET /api/v1/antojados/zonad/promos/mine?id=xxx
router.get('/promos/mine', (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id requerido' });
  send(res, svc.listMyPromos(id));
});

// DELETE /api/v1/antojados/zonad/promos/:id
router.delete('/promos/:id', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id requerido en body' });
  send(res, svc.deletePromo(id, req.params.id));
});

module.exports = router;
