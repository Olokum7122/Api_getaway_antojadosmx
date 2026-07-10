'use strict';

const resolver = require('./gt-efirmaResolver');
const mapper = require('./gt-efirmaMapper');

async function createElectronicSignature(payload, sourceHeaders) {
  const data = await resolver.createElectronicSignature(payload, sourceHeaders);
  return {
    ok: true,
    row: mapper.mapSignature(data?.row),
  };
}

async function sendElectronicSignatureActivation(payload, sourceHeaders) {
  const data = await resolver.sendElectronicSignatureActivation(payload, sourceHeaders);
  return {
    ok: true,
    activation: mapper.mapActivation(data?.activation),
    activation_token: data?.activation_token || null,
  };
}

async function acceptElectronicSignatureActivation(payload, sourceHeaders) {
  const data = await resolver.acceptElectronicSignatureActivation(payload, sourceHeaders);
  return {
    ok: true,
    signature: mapper.mapSignature(data?.signature),
    activation: mapper.mapActivation(data?.activation),
  };
}

async function authorizeElectronicSignatureAction(payload, sourceHeaders) {
  const data = await resolver.authorizeElectronicSignatureAction(payload, sourceHeaders);
  return {
    ok: true,
    row: mapper.mapAuthorization(data?.row),
  };
}

async function getElectronicSignatureStatus(instanceId, sourceHeaders) {
  const data = await resolver.getElectronicSignatureStatus(instanceId, sourceHeaders);
  return {
    ok: true,
    ...mapper.mapStatus(data),
  };
}

module.exports = {
  createElectronicSignature,
  sendElectronicSignatureActivation,
  acceptElectronicSignatureActivation,
  authorizeElectronicSignatureAction,
  getElectronicSignatureStatus,
};
