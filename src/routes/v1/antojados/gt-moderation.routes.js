'use strict';
const { Router } = require('express');
const svc = require('../../../services/antojados/gt-moderation.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/gt/moderation/queue
// Query: status?, content_type?, priority?
router.get('/gt/moderation/queue', (req, res) => {
  const { status, content_type, priority } = req.query;
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.getQueue({ status, content_type, priority, limit, offset })
    .then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/gt/moderation/:type/:id/approve
// Body: { reviewed_by, notes? }
router.post('/gt/moderation/:type/:id/approve', (req, res) => {
  const { reviewed_by, notes } = req.body;
  if (!reviewed_by) return res.status(400).json({ error: 'reviewed_by es requerido' });
  send(res, svc.approveContent(req.params.type, req.params.id, { reviewed_by, notes }));
});

// POST /api/v1/antojados/gt/moderation/:type/:id/reject
// Body: { reviewed_by, reason, notes? }
router.post('/gt/moderation/:type/:id/reject', (req, res) => {
  const { reviewed_by, reason, notes } = req.body;
  if (!reviewed_by) return res.status(400).json({ error: 'reviewed_by es requerido' });
  if (!reason)      return res.status(400).json({ error: 'reason es requerido' });
  send(res, svc.rejectContent(req.params.type, req.params.id, { reviewed_by, reason, notes }));
});

// App-facing — reportar contenido de usuario (§3.10 M9)
// POST /api/v1/antojados/social/report
// Body: { content_type, content_id, user_id, reason }
router.post('/social/report', (req, res) => {
  const { content_type, content_id, user_id, reason } = req.body;
  if (!content_type) return res.status(400).json({ error: 'content_type es requerido' });
  if (!content_id)   return res.status(400).json({ error: 'content_id es requerido' });
  if (!user_id)      return res.status(400).json({ error: 'user_id es requerido' });
  if (!reason)       return res.status(400).json({ error: 'reason es requerido' });
  send(res, svc.submitToQueue(null, {
    content_type,
    content_id,
    submitted_by: user_id,
    reason,
    priority: 'normal',
  }), 201);
});

module.exports = router;
