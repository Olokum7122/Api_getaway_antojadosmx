'use strict';
/**
 * feedback.service.js — Servicio de Feedback / Opiniones
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Feedback / Opiniones (web_launch_feedback)
 * RESPONSABLE:  Crear registros de feedback, agregar información de contacto
 *               y listar feedback con protección por token de administración.
 *
 * NO HACE:
 *   - No contiene lógica de negocio compleja (solo CRUD + sanitización)
 *
 * FUNCIONES:
 *   createFeedback     → insertar feedback
 *   addFeedbackContact → agregar datos de contacto a feedback existente
 *   listFeedback       → listar feedback (protegido con FEEDBACK_ADMIN_TOKEN)
 *
 * REFERENCIAS:
 *   - antojados_core.web_launch_feedback
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, randomUUID } = require('./_shared');

function clean(value, max) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function getClientIp(meta = {}) {
  const forwarded = clean(meta.forwarded_for, 300);
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 80);
  return clean(meta.ip, 80);
}

async function createFeedback(input = {}, meta = {}) {
  const comments = clean(input.comments, 900);
  const ideas = clean(input.ideas, 900);
  const questions = clean(input.questions, 900);
  const suggestions = clean(input.suggestions, 900);

  if (!comments && !ideas && !questions && !suggestions) {
    const err = new Error('opinion_requerida');
    err.status = 400;
    throw err;
  }

  const id = randomUUID();
  const pool = getPool('antojados');

  await pool.request()
    .input('id', sql.NVarChar(64), id)
    .input('source', sql.NVarChar(40), 'web-oficial')
    .input('comments', sql.NVarChar(900), comments)
    .input('ideas', sql.NVarChar(900), ideas)
    .input('questions', sql.NVarChar(900), questions)
    .input('suggestions', sql.NVarChar(900), suggestions)
    .input('pageUrl', sql.NVarChar(500), clean(input.page_url, 500))
    .input('userAgent', sql.NVarChar(500), clean(meta.user_agent, 500))
    .input('ipAddress', sql.NVarChar(80), getClientIp(meta))
    .query(`
      INSERT INTO antojados_core.web_launch_feedback
        (id, source, comments, ideas, questions, suggestions, page_url, user_agent, ip_address)
      VALUES
        (@id, @source, @comments, @ideas, @questions, @suggestions, @pageUrl, @userAgent, @ipAddress)
    `);

  return { ok: true, id };
}

async function addFeedbackContact(id, input = {}) {
  const feedbackId = clean(id, 64);
  const name = clean(input.name, 120);
  const email = clean(input.email, 160);
  const phone = clean(input.phone, 40);

  if (!feedbackId) {
    const err = new Error('feedback_id_requerido');
    err.status = 400;
    throw err;
  }

  if (!name && !email && !phone) {
    const err = new Error('contacto_requerido');
    err.status = 400;
    throw err;
  }

  const pool = getPool('antojados');
  const result = await pool.request()
    .input('id', sql.NVarChar(64), feedbackId)
    .input('name', sql.NVarChar(120), name)
    .input('email', sql.NVarChar(160), email)
    .input('phone', sql.NVarChar(40), phone)
    .query(`
      UPDATE antojados_core.web_launch_feedback
      SET
        wants_followup = 1,
        name = @name,
        email = @email,
        phone = @phone
      WHERE id = @id
    `);

  if (!result.rowsAffected?.[0]) {
    const err = new Error('feedback_no_encontrado');
    err.status = 404;
    throw err;
  }

  return { ok: true, id: feedbackId };
}

async function listFeedback({ status, category, limit = 100 } = {}) {
  const adminToken = process.env.FEEDBACK_ADMIN_TOKEN;
  if (!adminToken) {
    const err = new Error('feedback_admin_token_not_configured');
    err.status = 503;
    throw err;
  }

  const pool = getPool('antojados');
  const req = pool.request()
    .input('limit', sql.Int, Math.min(300, Math.max(1, Number(limit) || 100)));

  const where = [];

  if (status) {
    req.input('status', sql.NVarChar(30), clean(status, 30));
    where.push('status = @status');
  }

  if (category) {
    req.input('category', sql.NVarChar(40), clean(category, 40));
    where.push(`
      CASE @category
        WHEN N'comentario' THEN comments
        WHEN N'idea' THEN ideas
        WHEN N'pregunta' THEN questions
        WHEN N'sugerencia' THEN suggestions
      END IS NOT NULL
    `);
  }

  const result = await req.query(`
    SELECT TOP (@limit)
      id, source, comments, ideas, questions, suggestions, wants_followup,
      name, email, phone, page_url, status, admin_notes, created_at, reviewed_at, reviewed_by
    FROM antojados_core.web_launch_feedback
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
  `);

  return { ok: true, data: result.recordset };
}

module.exports = { createFeedback, addFeedbackContact, listFeedback };
