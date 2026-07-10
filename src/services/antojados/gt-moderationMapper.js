'use strict';

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name}: se esperaba array`);
  }
  return value;
}

function mapQueueList(rows) {
  return assertArray(rows, 'gt-moderationMapper.mapQueueList');
}

function mapModerationActionResult(raw) {
  if (raw == null) return null;
  if (!raw.content_type || !raw.content_id || !raw.decision) {
    throw new Error('gt-moderationMapper.mapModerationActionResult: payload incompleto');
  }
  return raw;
}

function mapSubmitToQueueResult(raw) {
  if (raw == null) return null;
  if (!raw.id) throw new Error('gt-moderationMapper.mapSubmitToQueueResult: id faltante');
  return raw;
}

module.exports = {
  mapQueueList,
  mapModerationActionResult,
  mapSubmitToQueueResult,
};