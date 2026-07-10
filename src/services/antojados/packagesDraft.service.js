'use strict';

const { getPool, sql } = require('./_shared');

/**
 * Service para explorer_core.package_drafts
 * Se conecta a la DB ATLX_EXPLORER_APP
 */

/**
 * Guarda o actualiza un draft (UPSERT por id_post)
 * 
 * Si id_post existe: UPDATE
 * Si no existe: INSERT (genera id_post auto si no se provee)
 */
async function saveDraft({
  id_post,
  package_type = 'defaultpackage',
  payload_json = '{}',
}) {
  const pool = getPool('explorerApp');

  // Si payload_json es objeto, stringify
  const payloadStr = typeof payload_json === 'object'
    ? JSON.stringify(payload_json)
    : payload_json;

  // Si no hay id_post, generar uno
  if (!id_post) {
    const crypto = require('crypto');
    id_post = 'draft-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
  }

  const result = await pool.request()
    .input('id_post', sql.NVarChar(255), id_post)
    .input('package_type', sql.NVarChar(20), package_type)
    .input('payload_json', sql.NVarChar(sql.MAX), payloadStr)
    .execute('explorer_core.usp_package_save_draft');

  return result.recordset[0] || { id_post, package_type };
}

/**
 * Lista drafts filtrados opcionalmente por package_type
 */
async function listDrafts({ package_type = null, limit = 50, offset = 0 } = {}) {
  const pool = getPool('explorerApp');

  let query = `
    SELECT id_post, package_type, payload_json, created_at
    FROM explorer_core.package_drafts
    WHERE 1=1
  `;
  const request = pool.request();

  if (package_type) {
    query += ' AND package_type = @package_type';
    request.input('package_type', sql.NVarChar(20), package_type);
  }

  query += ' ORDER BY created_at DESC';
  query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
  request.input('offset', sql.Int, offset);
  request.input('limit', sql.Int, limit);

  const result = await request.query(query);

  const packages = result.recordset.map(row => ({
    idPost: row.id_post,
    packageType: row.package_type,
    payload: row.payload_json,
    createdAt: row.created_at,
  }));

  const total = await countDrafts({ package_type });

  return { packages, total };
}

/**
 * Cuenta drafts (para paginación)
 */
async function countDrafts({ package_type = null } = {}) {
  const pool = getPool('explorerApp');
  let query = 'SELECT COUNT(*) AS total FROM explorer_core.package_drafts WHERE 1=1';
  const request = pool.request();
  if (package_type) {
    query += ' AND package_type = @package_type';
    request.input('package_type', sql.NVarChar(20), package_type);
  }
  const result = await request.query(query);
  return result.recordset[0]?.total || 0;
}

/**
 * Obtiene un draft por id_post
 */
async function getDraft(id_post) {
  const pool = getPool('explorerApp');
  const result = await pool.request()
    .input('id_post', sql.NVarChar(255), id_post)
    .query(`
      SELECT id_post, package_type, payload_json, created_at
      FROM explorer_core.package_drafts
      WHERE id_post = @id_post
    `);
  const row = result.recordset[0];
  if (!row) return null;
  return {
    idPost: row.id_post,
    packageType: row.package_type,
    payload: row.payload_json,
    createdAt: row.created_at,
  };
}

module.exports = {
  saveDraft,
  listDrafts,
  getDraft,
};
