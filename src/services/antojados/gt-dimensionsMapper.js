'use strict';

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name}: se esperaba array`);
  }
  return value;
}

function mapDimensionsList(rows) {
  return assertArray(rows, 'gt-dimensionsMapper.mapDimensionsList');
}

function mapSubDimensionsList(rows) {
  return assertArray(rows, 'gt-dimensionsMapper.mapSubDimensionsList');
}

function mapBatchApproveResult(raw) {
  if (raw == null) return null;
  if (typeof raw.updated !== 'number') {
    throw new Error('gt-dimensionsMapper.mapBatchApproveResult: updated faltante');
  }
  return raw;
}

function mapUpdateDimensionStatusResult(raw) {
  if (raw == null) return null;
  if (!raw.dimension_code) throw new Error('gt-dimensionsMapper.mapUpdateDimensionStatusResult: dimension_code faltante');
  return raw;
}

function mapUpdateSubDimensionStatusResult(raw) {
  if (raw == null) return null;
  if (!raw.sub_code) throw new Error('gt-dimensionsMapper.mapUpdateSubDimensionStatusResult: sub_code faltante');
  return raw;
}

function mapDeleteDimensionResult(raw) {
  if (raw == null) return null;
  if (raw.deleted !== true) throw new Error('gt-dimensionsMapper.mapDeleteDimensionResult: deleted inválido');
  return raw;
}

function mapDeleteSubDimensionResult(raw) {
  if (raw == null) return null;
  if (raw.deleted !== true) throw new Error('gt-dimensionsMapper.mapDeleteSubDimensionResult: deleted inválido');
  return raw;
}

function mapRunScannerResult(raw) {
  if (raw == null) return null;
  if (typeof raw.inserted_dims !== 'number') {
    throw new Error('gt-dimensionsMapper.mapRunScannerResult: inserted_dims faltante');
  }
  if (typeof raw.inserted_sub_dims !== 'number') {
    throw new Error('gt-dimensionsMapper.mapRunScannerResult: inserted_sub_dims faltante');
  }
  return raw;
}

module.exports = {
  mapDimensionsList,
  mapSubDimensionsList,
  mapBatchApproveResult,
  mapUpdateDimensionStatusResult,
  mapUpdateSubDimensionStatusResult,
  mapDeleteDimensionResult,
  mapDeleteSubDimensionResult,
  mapRunScannerResult,
};