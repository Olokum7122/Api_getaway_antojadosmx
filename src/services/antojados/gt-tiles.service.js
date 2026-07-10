'use strict';
const gtTilesResolver = require('./gt-tilesResolver');
const {
  mapTileList,
  mapApproveTileResult,
  mapRejectTileResult,
  mapDisableTileResult,
} = require('./gt-tilesMapper');

async function listPendingTiles(payload) {
  return mapTileList(await gtTilesResolver.listPendingTiles(payload));
}

async function getTenantTiles(sponsorBizId, payload) {
  return mapTileList(await gtTilesResolver.getTenantTiles(sponsorBizId, payload));
}

async function approveTile(tileId, payload) {
  return mapApproveTileResult(await gtTilesResolver.approveTile(tileId, payload));
}

async function rejectTile(tileId, payload) {
  return mapRejectTileResult(await gtTilesResolver.rejectTile(tileId, payload));
}

async function disableTile(tileId, operatorId) {
  return mapDisableTileResult(await gtTilesResolver.disableTile(tileId, operatorId));
}

module.exports = { listPendingTiles, getTenantTiles, approveTile, rejectTile, disableTile };
