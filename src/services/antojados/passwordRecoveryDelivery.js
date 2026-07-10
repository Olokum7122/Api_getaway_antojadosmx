'use strict';
/**
 * passwordRecoveryDelivery.js — Entrega de Códigos de Recuperación
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Autenticación (Auth)
 * RESPONSABLE:  Normalizar canal de entrega, enmascarar datos de contacto
 *               y enviar código de recuperación vía webhook (email/SMS).
 *
 * NO HACE:
 *   - No consulta BD (lo hace authResolver)
 *   - No valida códigos (lo hace authResolver)
 *
 * FUNCIONES:
 *   normalizeChannel      → normaliza 'email' | 'sms'
 *   resolveTarget         → obtiene target + masked según canal
 *   postWebhook           → envía POST al webhook configurado
 *   deliverRecoveryCode   → orquesta entrega con manejo de errores
 *
 * CONFIGURACIÓN (variables de entorno):
 *   PASSWORD_RECOVERY_EMAIL_WEBHOOK_URL
 *   PASSWORD_RECOVERY_SMS_WEBHOOK_URL
 *   PASSWORD_RECOVERY_WEBHOOK_TOKEN (Bearer opcional)
 *   PASSWORD_RECOVERY_ALLOW_DIRECT_CODE (dev mode)
 *
 * REFERENCIAS:
 *   - authResolver.js (requestPasswordRecovery)
 * ══════════════════════════════════════════════════════════════════════════════
 */

function normalizeChannel(channel) {
  const value = String(channel || '').trim().toLowerCase();
  if (value === 'sms') return 'sms';
  if (value === 'email' || value === 'correo') return 'email';
  return 'email';
}

function maskEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  const [user, domain] = value.split('@');
  if (!user || !domain) return null;
  return `${user.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone) {
  const value = String(phone || '').trim();
  if (!value) return null;
  return `${value.slice(0, Math.max(0, value.length - 4)).replace(/\d/g, '*')}${value.slice(-4)}`;
}

function resolveTarget({ channel, email, phone_e164 }) {
  if (channel === 'sms') {
    const phone = String(phone_e164 || '').trim();
    return {
      target: phone || null,
      masked: maskPhone(phone),
    };
  }

  const rawEmail = String(email || '').trim().toLowerCase();
  return {
    target: rawEmail || null,
    masked: maskEmail(rawEmail),
  };
}

async function postWebhook(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.PASSWORD_RECOVERY_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.PASSWORD_RECOVERY_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(`Proveedor recovery HTTP ${response.status}`);
    error.providerResponse = data;
    throw error;
  }

  return data || {};
}

async function deliverRecoveryCode({ channel, target, code, recoveryRequestId, userId }) {
  const normalizedChannel = normalizeChannel(channel);
  const webhookUrl = normalizedChannel === 'sms'
    ? process.env.PASSWORD_RECOVERY_SMS_WEBHOOK_URL
    : process.env.PASSWORD_RECOVERY_EMAIL_WEBHOOK_URL;

  if (!target) {
    return {
      status: 'missing_target',
      provider: null,
      providerMessageId: null,
      rawResponse: null,
      error: normalizedChannel === 'sms'
        ? 'La cuenta no tiene telefono para SMS.'
        : 'No se recibio correo de destino para enviar el codigo.',
    };
  }

  if (!webhookUrl) {
    const allowDirectCode = String(process.env.PASSWORD_RECOVERY_ALLOW_DIRECT_CODE || '').toLowerCase() === 'true';
    return {
      status: allowDirectCode ? 'dev_direct_response' : 'provider_not_configured',
      provider: null,
      providerMessageId: null,
      rawResponse: null,
      error: allowDirectCode ? null : `No esta configurado PASSWORD_RECOVERY_${normalizedChannel.toUpperCase()}_WEBHOOK_URL.`,
    };
  }

  try {
    const response = await postWebhook(webhookUrl, {
      channel: normalizedChannel,
      to: target,
      code,
      recovery_request_id: recoveryRequestId,
      user_id: userId,
      app: 'AntojadosMX',
      message: `Tu codigo de recuperacion AntojadosMX es ${code}. Expira en 15 minutos.`,
    });

    return {
      status: 'sent',
      provider: response.provider || `${normalizedChannel}_webhook`,
      providerMessageId: response.message_id || response.id || null,
      rawResponse: response,
      error: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      provider: `${normalizedChannel}_webhook`,
      providerMessageId: null,
      rawResponse: error.providerResponse || null,
      error: error.message,
    };
  }
}

module.exports = {
  deliverRecoveryCode,
  normalizeChannel,
  resolveTarget,
};
