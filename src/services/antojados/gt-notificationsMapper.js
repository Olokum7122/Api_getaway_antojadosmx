'use strict';

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name}: se esperaba array`);
  }
  return value;
}

function mapNotificationList(rows) {
  return assertArray(rows, 'gt-notificationsMapper.mapNotificationList');
}

function mapNotificationCreateResult(raw) {
  if (raw == null) return null;
  if (!raw.id) throw new Error('gt-notificationsMapper.mapNotificationCreateResult: id faltante');
  return raw;
}

function mapSequenceList(rows) {
  return assertArray(rows, 'gt-notificationsMapper.mapSequenceList');
}

function mapSequenceCreateResult(raw) {
  if (raw == null) return null;
  if (!raw.id) throw new Error('gt-notificationsMapper.mapSequenceCreateResult: id faltante');
  return raw;
}

function mapSequenceAssignmentResult(raw) {
  if (raw == null) return null;
  if (!raw.id) throw new Error('gt-notificationsMapper.mapSequenceAssignmentResult: id faltante');
  return raw;
}

function mapNotificationReadResult(raw) {
  if (raw == null) return null;
  if (raw.status !== 'read') throw new Error('gt-notificationsMapper.mapNotificationReadResult: status inválido');
  return raw;
}

module.exports = {
  mapNotificationList,
  mapNotificationCreateResult,
  mapSequenceList,
  mapSequenceCreateResult,
  mapSequenceAssignmentResult,
  mapNotificationReadResult,
};