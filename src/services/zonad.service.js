'use strict';
// Service: ZonaD (delivery de patrocinadores)
// Toda la lógica SQL vive aquí. El router sólo valida y delega.

const { getPool } = require('../db');

// ─── CONFIG ──────────────────────────────────────────────────

/**
 * Retorna el mapa de feature flags de ZonaD desde app_config.
 * { zonad_enabled: bool, zonad_payment_online: bool }
 */
async function getConfig() {
  const pool = getPool('antojados');
  const result = await pool.request().query(`
    SELECT config_key, config_value
    FROM antojados_core.sys_app_config
    WHERE config_key IN ('zonad_enabled', 'zonad_payment_online')
  `);
  const map = {};
  for (const row of result.recordset) {
    map[row.config_key] = row.config_value === 'true';
  }
  return {
    zonad_enabled:        map.zonad_enabled        ?? false,
    zonad_payment_online: map.zonad_payment_online ?? false,
  };
}

// ─── GALERÍA DE PROMOS ────────────────────────────────────────

/**
 * Lista de promos activas para la galería.
 * Ordenadas por order_count DESC para surface los más populares primero.
 * @param {string|null} category_tag  - Filtro opcional
 * @param {number}      limit
 * @param {number}      offset
 */
async function listPromos({ category_tag = null, limit = 40, offset = 0 } = {}) {
  const pool = getPool('antojados');
  const req = pool.request();
  req.input('limit',  limit);
  req.input('offset', offset);

  let filter = '';
  if (category_tag) {
    req.input('category_tag', category_tag);
    filter = 'AND zp.category_tag = @category_tag';
  }

  const result = await req.query(`
    SELECT
      zp.zonad_promo_id,
      zp.id,
      sp.biz_name     AS place_name,
      sp.biz_type,
      zp.promo_img_url,
      zp.category_tag,
      zp.order_count,
      zp.valid_from,
      zp.valid_until
    FROM antojados_core.zonad_promos zp
    JOIN antojados_core.soc_places   sp ON sp.id = zp.id
    WHERE zp.status    = 'active'
      AND sp.status    = 'active'
      AND sp.zonad_enabled = 1
      ${filter}
    ORDER BY zp.order_count DESC, zp.created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);
  return result.recordset;
}

/**
 * Valores distintos de category_tag de promos activas.
 * Usa la app para construir el filtro dinámico.
 */
async function listPromoFilters() {
  const pool = getPool('antojados');
  const result = await pool.request().query(`
    SELECT DISTINCT zp.category_tag
    FROM antojados_core.zonad_promos zp
    JOIN antojados_core.soc_places   sp ON sp.id = zp.id
    WHERE zp.status = 'active' AND sp.status = 'active' AND sp.zonad_enabled = 1
    ORDER BY zp.category_tag
  `);
  return result.recordset.map(r => r.category_tag);
}

// ─── CATÁLOGO POR PROVEEDOR ───────────────────────────────────

/**
 * Productos activos de un proveedor para CartaD.
 */
async function getCatalog(id) {
  const pool = getPool('antojados');
  const result = await pool.request()
    .input('id', id)
    .query(`
      SELECT
        zonad_product_id,
        title,
        description,
        price,
        category_tag,
        media_url,
        order_count
      FROM antojados_core.zonad_products
      WHERE id      = @id
        AND delivery_active = 1
        AND status          = 'active'
      ORDER BY category_tag, title
    `);
  return result.recordset;
}

// ─── ÓRDENES ─────────────────────────────────────────────────

/**
 * Crear una orden nueva (atómica via SP).
 * items = [{ zonad_product_id, product_title, unit_price, quantity, notes }]
 */
async function placeOrder({
  order_id, id, user_id,
  delivery_address, delivery_lat, delivery_lng,
  subtotal, total, payment_method = 'cash',
  notes, created_at_client, items,
}) {
  const pool = getPool('antojados');
  await pool.request()
    .input('orderId',         order_id)
    .input('instanceId',         id)
    .input('userId',          user_id)
    .input('deliveryAddress', delivery_address)
    .input('deliveryLat',     delivery_lat   ?? null)
    .input('deliveryLng',     delivery_lng   ?? null)
    .input('subtotal',        subtotal)
    .input('total',           total)
    .input('paymentMethod',   payment_method)
    .input('notes',           notes          ?? null)
    .input('createdAtClient', new Date(created_at_client))
    .input('itemsJson',       JSON.stringify(items))
    .execute('antojados_core.usp_zonad_place_order');

  return { order_id };
}

/**
 * Órdenes de un usuario — historial paginado.
 */
async function getOrdersByUser(user_id, { limit = 20, offset = 0 } = {}) {
  const pool = getPool('antojados');
  const result = await pool.request()
    .input('user_id', user_id)
    .input('limit',   limit)
    .input('offset',  offset)
    .query(`
      SELECT
        zo.zonad_order_id,
        zo.id,
        sp.biz_name      AS place_name,
        zo.total,
        zo.order_status,
        zo.payment_method,
        zo.payment_status,
        zo.received_at_server
      FROM antojados_core.zonad_orders zo
      JOIN antojados_core.soc_places   sp ON sp.id = zo.id
      WHERE zo.user_id = @user_id
      ORDER BY zo.received_at_server DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return result.recordset;
}

/**
 * Cancelar una orden (sólo si está en estado pendiente/confirmado).
 */
async function cancelOrder(order_id, user_id, reason) {
  const pool = getPool('antojados');
  const result = await pool.request()
    .input('order_id', order_id)
    .input('user_id',  user_id)
    .input('reason',   reason ?? null)
    .query(`
      UPDATE antojados_core.zonad_orders
      SET order_status    = 'cancelled',
          cancelled_reason = @reason,
          updated_at       = SYSUTCDATETIME()
      WHERE zonad_order_id = @order_id
        AND user_id         = @user_id
        AND order_status IN ('pending', 'confirmed')
    `);
  const affected = result.rowsAffected?.[0] ?? 0;
  if (affected === 0) throw Object.assign(new Error('order_not_cancellable'), { status: 409 });
  return { order_id, order_status: 'cancelled' };
}

// ─── PRODUCTOS (proveedor) ────────────────────────────────────

/**
 * Crear un producto ZonaD para el proveedor autenticado.
 */
async function createProduct(id, { zonad_product_id, title, description, price, category_tag, media_url }) {
  const pool = getPool('antojados');
  await pool.request()
    .input('id',           zonad_product_id)
    .input('id',     id)
    .input('title',        title)
    .input('description',  description ?? null)
    .input('price',        price)
    .input('category_tag', category_tag)
    .input('media_url',    media_url ?? null)
    .query(`
      INSERT INTO antojados_core.zonad_products
        (zonad_product_id, id, title, description, price, category_tag, media_url)
      VALUES
        (@id, @id, @title, @description, @price, @category_tag, @media_url)
    `);
  return { zonad_product_id };
}

/**
 * Listar productos del proveedor (activos e inactivos, excluye deleted).
 */
async function listProducts(id) {
  const pool = getPool('antojados');
  const result = await pool.request()
    .input('id', id)
    .query(`
      SELECT zonad_product_id, title, description, price,
             category_tag, media_url, delivery_active, status, order_count
      FROM antojados_core.zonad_products
      WHERE id = @id AND status <> 'deleted'
      ORDER BY category_tag, title
    `);
  return result.recordset;
}

/**
 * Actualizar un producto del proveedor.
 */
async function updateProduct(id, zonad_product_id, fields) {
  const allowed = ['title', 'description', 'price', 'category_tag', 'media_url', 'delivery_active', 'status'];
  const sets = [];
  const pool = getPool('antojados');
  const req = pool.request()
    .input('id',        id)
    .input('product_id',      zonad_product_id);

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      req.input(key, fields[key]);
      sets.push(`${key} = @${key}`);
    }
  }
  if (sets.length === 0) throw Object.assign(new Error('no_fields_to_update'), { status: 400 });
  sets.push('updated_at = SYSUTCDATETIME()');

  const result = await req.query(`
    UPDATE antojados_core.zonad_products
    SET ${sets.join(', ')}
    WHERE zonad_product_id = @product_id AND id = @id AND status <> 'deleted'
  `);
  const affected = result.rowsAffected?.[0] ?? 0;
  if (affected === 0) throw Object.assign(new Error('product_not_found'), { status: 404 });
  return { zonad_product_id };
}

/**
 * Soft-delete de un producto del proveedor.
 */
async function deleteProduct(id, zonad_product_id) {
  const pool = getPool('antojados');
  const result = await pool.request()
    .input('id',   id)
    .input('product_id', zonad_product_id)
    .query(`
      UPDATE antojados_core.zonad_products
      SET status = 'deleted', delivery_active = 0, updated_at = SYSUTCDATETIME()
      WHERE zonad_product_id = @product_id AND id = @id
    `);
  const affected = result.rowsAffected?.[0] ?? 0;
  if (affected === 0) throw Object.assign(new Error('product_not_found'), { status: 404 });
  return { zonad_product_id, status: 'deleted' };
}

// ─── PROMOS (proveedor) ───────────────────────────────────────

/**
 * Crear una promo PNG para el proveedor.
 */
async function createPromo(id, { zonad_promo_id, promo_img_url, category_tag, valid_from, valid_until }) {
  const pool = getPool('antojados');
  await pool.request()
    .input('id',          zonad_promo_id)
    .input('id',    id)
    .input('img_url',     promo_img_url)
    .input('cat',         category_tag)
    .input('valid_from',  valid_from  ? new Date(valid_from)  : null)
    .input('valid_until', valid_until ? new Date(valid_until) : null)
    .query(`
      INSERT INTO antojados_core.zonad_promos
        (zonad_promo_id, id, promo_img_url, category_tag, valid_from, valid_until)
      VALUES
        (@id, @id, @img_url, @cat, @valid_from, @valid_until)
    `);
  return { zonad_promo_id };
}

/**
 * Promos del proveedor (para panel de gestión).
 */
async function listMyPromos(id) {
  const pool = getPool('antojados');
  const result = await pool.request()
    .input('id', id)
    .query(`
      SELECT zonad_promo_id, promo_img_url, category_tag,
             valid_from, valid_until, status, order_count
      FROM antojados_core.zonad_promos
      WHERE id = @id AND status <> 'deleted'
      ORDER BY created_at DESC
    `);
  return result.recordset;
}

/**
 * Soft-delete de una promo del proveedor.
 */
async function deletePromo(id, zonad_promo_id) {
  const pool = getPool('antojados');
  const result = await pool.request()
    .input('id', id)
    .input('promo_id', zonad_promo_id)
    .query(`
      UPDATE antojados_core.zonad_promos
      SET status = 'deleted', updated_at = SYSUTCDATETIME()
      WHERE zonad_promo_id = @promo_id AND id = @id
    `);
  const affected = result.rowsAffected?.[0] ?? 0;
  if (affected === 0) throw Object.assign(new Error('promo_not_found'), { status: 404 });
  return { zonad_promo_id, status: 'deleted' };
}

module.exports = {
  getConfig,
  listPromos,
  listPromoFilters,
  getCatalog,
  placeOrder,
  getOrdersByUser,
  cancelOrder,
  createProduct,
  listProducts,
  updateProduct,
  deleteProduct,
  createPromo,
  listMyPromos,
  deletePromo,
};
