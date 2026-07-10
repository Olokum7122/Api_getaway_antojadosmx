'use strict';

const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function sponsorBizIdFromRaw(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return raw[SPONSOR_BIZ_KEY] || raw.sponsor_biz_id || null;
}

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name}: se esperaba array`);
  }
  return value;
}

function mapTenantList(rows) { return assertArray(rows, 'gt-tenantsMapper.mapTenantList'); }

function mapTenantDetail(raw) {
  if (raw == null) return null;
  if (!raw.id) throw new Error('gt-tenantsMapper.mapTenantDetail: id faltante');
  return raw;
}

function mapActivateTenantResult(raw) {
  if (raw == null) return null;
  if (!sponsorBizIdFromRaw(raw) || !raw.instance_id) throw new Error('gt-tenantsMapper.mapActivateTenantResult: payload incompleto');
  return raw;
}

function mapSuspendTenantResult(raw) {
  if (raw == null) return null;
  if (!sponsorBizIdFromRaw(raw) || !raw.suspension_id) throw new Error('gt-tenantsMapper.mapSuspendTenantResult: payload incompleto');
  return raw;
}

function mapReactivateTenantResult(raw) {
  if (raw == null) return null;
  if (!sponsorBizIdFromRaw(raw) || !raw.status) throw new Error('gt-tenantsMapper.mapReactivateTenantResult: payload incompleto');
  return raw;
}

function mapTenantExpedienteList(rows) {
  return assertArray(rows, 'gt-tenantsMapper.mapTenantExpedienteList');
}

function mapReviewTenantExpedienteResult(raw) {
  if (raw == null) return null;
  if (!raw.id || !raw.review_status) throw new Error('gt-tenantsMapper.mapReviewTenantExpedienteResult: payload incompleto');
  return raw;
}

function mapUpdateScreenResult(raw) {
  if (raw == null) return null;
  if (!raw[SPONSOR_BIZ_KEY] || !raw.sub_code) throw new Error('gt-tenantsMapper.mapUpdateScreenResult: payload incompleto');
  return raw;
}

module.exports = {
  mapTenantList,
  mapTenantDetail,
  mapActivateTenantResult,
  mapSuspendTenantResult,
  mapReactivateTenantResult,
  mapTenantExpedienteList,
  mapReviewTenantExpedienteResult,
};