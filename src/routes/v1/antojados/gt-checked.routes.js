'use strict';

const { Router } = require('express');
const svc = require('../../../services/antojados/gt-cascades.service');
const { send } = require('./_helpers');

const router = Router();

function checkedFlag(row) {
  return row?.visible === true || row?.enabled === true;
}

function mapCheckedDimension(row) {
  const checked = checkedFlag(row);
  return {
    ...row,
    is_checked: checked,
    visible_override: row.visible,
    enabled_override: row.enabled,
    effective_visible: row.visible,
    effective_enabled: row.enabled,
    control_mode: 'OPERABLE',
  };
}

function mapCheckedSubDimension(row) {
  const checked = checkedFlag(row);
  return {
    ...row,
    is_checked: checked,
    visible_override: row.visible,
    enabled_override: row.enabled,
    effective_visible: row.visible,
    effective_enabled: row.enabled,
    control_mode: 'OPERABLE',
  };
}

async function getCascade(instanceId) {
  const cascade = await svc.getInstanceCascade(instanceId);
  if (!cascade) return null;
  return cascade;
}

// GET /api/v1/antojados/gt/instances/:instance_id/checked/dimensions
router.get('/gt/instances/:instance_id/checked/dimensions', (req, res) => {
  send(res, getCascade(req.params.instance_id).then((cascade) => {
    if (!cascade) return null;
    return {
      instance: cascade.instance,
      instance_type: cascade.instance.instance_type,
      dimension_locations: cascade.dimension_locations.map(mapCheckedDimension),
    };
  }));
});

// GET /api/v1/antojados/gt/instances/:instance_id/checked/sub-dimensions
router.get('/gt/instances/:instance_id/checked/sub-dimensions', (req, res) => {
  send(res, getCascade(req.params.instance_id).then((cascade) => {
    if (!cascade) return null;
    return {
      instance: cascade.instance,
      instance_type: cascade.instance.instance_type,
      sub_dimension_locations: cascade.sub_dimension_locations.map(mapCheckedSubDimension),
    };
  }));
});

// GET /api/v1/antojados/gt/instances/:instance_id/checked/events
router.get('/gt/instances/:instance_id/checked/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write(`event: checked.ready\ndata: {"instance_id":"${String(req.params.instance_id || '').replace(/"/g, '')}"}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    res.end();
  });
});

module.exports = router;