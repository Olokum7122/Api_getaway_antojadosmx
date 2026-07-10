'use strict';

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name}: se esperaba array`);
  }
  return value;
}

function mapSettingsList(rows) { return assertArray(rows, 'gt-opsMapper.mapSettingsList'); }
function mapAuditLogList(rows) { return assertArray(rows, 'gt-opsMapper.mapAuditLogList'); }
function mapTenantSuspensionsList(rows) { return assertArray(rows, 'gt-opsMapper.mapTenantSuspensionsList'); }
function mapEconomicSnapshotList(rows) { return assertArray(rows, 'gt-opsMapper.mapEconomicSnapshotList'); }
function mapTenantPackagesList(rows) { return assertArray(rows, 'gt-opsMapper.mapTenantPackagesList'); }

function mapUpdateSettingResult(raw) {
  if (raw == null) return null;
  if (!raw.config_key) throw new Error('gt-opsMapper.mapUpdateSettingResult: config_key faltante');
  return raw;
}

function mapEconomicSnapshotSyncResult(raw) {
  if (raw == null) return null;
  if (!raw.id) throw new Error('gt-opsMapper.mapEconomicSnapshotSyncResult: id faltante');
  return raw;
}

function mapTenantPackageResult(raw) {
  if (raw == null) return null;
  if (!raw.package_code && !raw.id) throw new Error('gt-opsMapper.mapTenantPackageResult: payload incompleto');
  return raw;
}

function mapEconomicEventResult(raw) {
  if (raw == null) return null;
  if (!raw.event) throw new Error('gt-opsMapper.mapEconomicEventResult: event faltante');
  return raw;
}

module.exports = {
  mapSettingsList,
  mapUpdateSettingResult,
  mapAuditLogList,
  mapTenantSuspensionsList,
  mapEconomicSnapshotList,
  mapEconomicSnapshotSyncResult,
  mapTenantPackagesList,
  mapTenantPackageResult,
  mapEconomicEventResult,
};