'use strict';
const gtCascadesResolver = require('./gt-cascadesResolver');
const {
  mapInstance,
  mapDimensionLocation,
  mapSubDimensionLocation,
  mapReusableSummary,
  mapReusableDimensionLocation,
  mapReusableSubDimensionLocation,
  mapInstanceCascade,
  mapReusableCascade,
  mapRebuildInstanceCascade,
  mapRebuildReusableCascade,
} = require('./gt-cascadesMapper');

async function listInstances(payload) {
  return gtCascadesResolver.listInstances(payload).then(rows => rows.map(mapInstance));
}

async function getInstance(instanceId) {
  return mapInstance(await gtCascadesResolver.getInstance(instanceId));
}

async function getInstanceCascade(instanceId) {
  return mapInstanceCascade(await gtCascadesResolver.getInstanceCascade(instanceId), { mapInstance, mapDimensionLocation, mapSubDimensionLocation });
}

async function getSponsorCascade(sponsorBizId) {
  return getInstanceCascade(await gtCascadesResolver.getSponsorCascade(sponsorBizId));
}

async function getUserCascade(userId) {
  return getInstanceCascade(await gtCascadesResolver.getUserCascade(userId));
}

async function listReusableCascades(payload) {
  return gtCascadesResolver.listReusableCascades(payload).then(rows => rows.map(mapReusableSummary));
}

async function getReusableCascade(reusableCode, options) {
  return mapReusableCascade(await gtCascadesResolver.getReusableCascade(reusableCode, options), {
    mapReusableSummary,
    mapReusableDimensionLocation,
    mapReusableSubDimensionLocation,
  });
}

async function rebuildInstanceCascade(instanceId) {
  return mapRebuildInstanceCascade(await gtCascadesResolver.rebuildInstanceCascade(instanceId));
}

async function rebuildReusableCascade(reusableCode, options) {
  return mapRebuildReusableCascade(await gtCascadesResolver.rebuildReusableCascade(reusableCode, options));
}

module.exports = {
  listInstances,
  getInstance,
  getInstanceCascade,
  getSponsorCascade,
  getUserCascade,
  listReusableCascades,
  getReusableCascade,
  rebuildInstanceCascade,
  rebuildReusableCascade,
};

// Backward-compatible alias.
module.exports.getTenantCascade = getSponsorCascade;