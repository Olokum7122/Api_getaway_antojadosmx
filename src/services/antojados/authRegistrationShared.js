'use strict';
/**
 * authRegistrationShared.js — Lógica Compartida de Registro
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Autenticación (Auth)
 * RESPONSABLE:  Validar disponibilidad de registro (verificar duplicados
 *               de user_id y email_hash) para evitar colisiones.
 *
 * NO HACE:
 *   - No crea usuarios (lo hacen authSocialResolver/authSponsorResolver)
 *   - No maneja sesiones (lo hace authResolver)
 *
 * FUNCIONES:
 *   assertRegistrationAvailable → verifica que user_id y email no estén tomados
 *   getRegistrationRequest      → obtiene Request de pool 'antojados'
 *
 * REFERENCIAS:
 *   - authSocialResolver.js, authSponsorResolver.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql } = require('./_shared');

async function assertRegistrationAvailable({ request, user_id, email_hash }) {
  const duplicate = await request
    .input('user_id', sql.NVarChar(64), user_id)
    .input('emailHash', sql.NVarChar(128), email_hash)
    .query(`
      SELECT TOP 1
        CASE
          WHEN user_id = @user_id THEN 'same_user'
          ELSE 'email_taken'
        END AS duplicate_reason
      FROM antojados_core.auth_identities
      WHERE user_id = @user_id
         OR email_hash = @emailHash
      ORDER BY CASE WHEN user_id = @user_id THEN 0 ELSE 1 END
    `);

  const reason = duplicate.recordset[0]?.duplicate_reason || null;
  if (!reason) return;

  if (reason === 'same_user') {
    throw Object.assign(new Error('user_id ya registrado.'), { status: 409 });
  }
  throw Object.assign(new Error('Ya existe una cuenta con ese correo.'), { status: 409 });
}

function getRegistrationRequest() {
  return getPool('antojados').request();
}

module.exports = {
  assertRegistrationAvailable,
  getRegistrationRequest,
};
