'use strict';
const gtNotificationsResolver = require('./gt-notificationsResolver');
const {
  mapNotificationList,
  mapNotificationCreateResult,
  mapSequenceList,
  mapSequenceCreateResult,
  mapSequenceAssignmentResult,
  mapNotificationReadResult,
} = require('./gt-notificationsMapper');

async function getNotifications(tenantContextId, payload) {
  return mapNotificationList(await gtNotificationsResolver.getNotifications(tenantContextId, payload));
}

async function createNotification(tenantContextId, payload) {
  return mapNotificationCreateResult(await gtNotificationsResolver.createNotification(tenantContextId, payload));
}

async function listSequences(payload) {
  return mapSequenceList(await gtNotificationsResolver.listSequences(payload));
}

async function createSequence(payload) {
  return mapSequenceCreateResult(await gtNotificationsResolver.createSequence(payload));
}

async function assignSequence(sequenceId, instanceId, assignedBy) {
  return mapSequenceAssignmentResult(await gtNotificationsResolver.assignSequence(sequenceId, instanceId, assignedBy));
}

async function markNotificationRead(notifId) {
  return mapNotificationReadResult(await gtNotificationsResolver.markNotificationRead(notifId));
}

async function resolveTenantIdByInstance(instanceId) {
  return gtNotificationsResolver.resolveTenantIdByInstance(instanceId);
}

module.exports = {
  getNotifications,
  createNotification,
  listSequences,
  createSequence,
  assignSequence,
  markNotificationRead,
  resolveTenantIdByInstance,
};
