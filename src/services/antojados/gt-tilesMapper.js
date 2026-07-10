'use strict';

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name}: se esperaba array`);
  }
  return value;
}

function mapTileList(rows) {
  return assertArray(rows, 'gt-tilesMapper.mapTileList');
}

function mapApproveTileResult(raw) {
  if (raw == null) return null;
  if (!raw.tile_id || !raw.status) throw new Error('gt-tilesMapper.mapApproveTileResult: payload incompleto');
  return raw;
}

function mapRejectTileResult(raw) {
  if (raw == null) return null;
  if (!raw.tile_id || !raw.status) throw new Error('gt-tilesMapper.mapRejectTileResult: payload incompleto');
  return raw;
}

function mapDisableTileResult(raw) {
  if (raw == null) return null;
  if (!raw.tile_id || !raw.status) throw new Error('gt-tilesMapper.mapDisableTileResult: payload incompleto');
  return raw;
}

module.exports = {
  mapTileList,
  mapApproveTileResult,
  mapRejectTileResult,
  mapDisableTileResult,
};