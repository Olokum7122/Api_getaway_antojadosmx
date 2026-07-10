"use strict";

const gtTenantsResolver = require("./gt-tenantsResolver");
const {
  mapTenantList,
  mapTenantDetail,
  mapActivateTenantResult,
  mapSuspendTenantResult,
  mapReactivateTenantResult,
  mapTenantExpedienteList,
  mapReviewTenantExpedienteResult,
} = require("./gt-tenantsMapper");

async function listTenants(payload) {
  return mapTenantList(await gtTenantsResolver.listTenants(payload));
}

async function getTenant(sponsorBizId) {
  return mapTenantDetail(await gtTenantsResolver.getTenant(sponsorBizId));
}

async function activateTenant(sponsorBizId, operatorId) {
  return mapActivateTenantResult(
    await gtTenantsResolver.activateTenant(sponsorBizId, operatorId),
  );
}

async function suspendTenant(sponsorBizId, payload) {
  return mapSuspendTenantResult(
    await gtTenantsResolver.suspendTenant(sponsorBizId, payload),
  );
}

async function reactivateTenant(sponsorBizId, operatorId) {
  return mapReactivateTenantResult(
    await gtTenantsResolver.reactivateTenant(sponsorBizId, operatorId),
  );
}

async function listTenantExpediente(sponsorBizId, payload) {
  return mapTenantExpedienteList(
    await gtTenantsResolver.listTenantExpediente(sponsorBizId, payload),
  );
}

async function reviewTenantExpedienteDocument(sponsorBizId, documentId, payload) {
  return mapReviewTenantExpedienteResult(
    await gtTenantsResolver.reviewTenantExpedienteDocument(sponsorBizId, documentId, payload),
  );
}

module.exports = {
  listTenants,
  getTenant,
  activateTenant,
  suspendTenant,
  reactivateTenant,
  listTenantExpediente,
  reviewTenantExpedienteDocument,
};
