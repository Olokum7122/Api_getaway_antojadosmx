'use strict';
const gtOpsResolver = require('./gt-opsResolver');
const {
  mapSettingsList,
  mapUpdateSettingResult,
  mapAuditLogList,
  mapTenantSuspensionsList,
  mapEconomicSnapshotList,
  mapEconomicSnapshotSyncResult,
  mapTenantPackagesList,
  mapTenantPackageResult,
  mapEconomicEventResult,
} = require('./gt-opsMapper');

async function getSettings() {
  return mapSettingsList(await gtOpsResolver.getSettings());
}

async function updateSetting(key, payload) {
  return mapUpdateSettingResult(await gtOpsResolver.updateSetting(key, payload));
}

async function getAuditLog(payload) {
  return mapAuditLogList(await gtOpsResolver.getAuditLog(payload));
}

async function getTenantSuspensions(sponsorBizId, payload) {
  return mapTenantSuspensionsList(await gtOpsResolver.getTenantSuspensions(sponsorBizId, payload));
}

async function getEconomicSnapshot(sponsorBizId, payload) {
  return mapEconomicSnapshotList(await gtOpsResolver.getEconomicSnapshot(sponsorBizId, payload));
}

async function syncEconomicSnapshot(sponsorBizId, payload) {
  return mapEconomicSnapshotSyncResult(await gtOpsResolver.syncEconomicSnapshot(sponsorBizId, payload));
}

async function getTenantPackages(sponsorBizId) {
  return mapTenantPackagesList(await gtOpsResolver.getTenantPackages(sponsorBizId));
}

async function upsertTenantPackage(sponsorBizId, packageCode, payload) {
  return mapTenantPackageResult(await gtOpsResolver.upsertTenantPackage(sponsorBizId, packageCode, payload));
}

async function processEconomicEvent(sponsorBizId, payload) {
  return mapEconomicEventResult(await gtOpsResolver.processEconomicEvent(sponsorBizId, payload));
}

module.exports = {
  getSettings,
  updateSetting,
  getAuditLog,
  getTenantSuspensions,
  getEconomicSnapshot,
  syncEconomicSnapshot,
  getTenantPackages,
  upsertTenantPackage,
  processEconomicEvent,
};
