"use strict";
const gtDimensionsResolver = require("./gt-dimensionsResolver");
const {
  mapDimensionsList,
  mapSubDimensionsList,
  mapBatchApproveResult,
  mapUpdateDimensionStatusResult,
  mapUpdateSubDimensionStatusResult,
  mapDeleteDimensionResult,
  mapDeleteSubDimensionResult,
  mapRunScannerResult,
} = require("./gt-dimensionsMapper");
const { randomUUID } = require("./_shared");
const fs = require("fs/promises");
const path = require("path");
const { pathToFileURL } = require("url");

// GT-DIMENSIONS â€” catÃ¡logo sys_dimension y sys_sub_dimension (Â§1.3.7)
// Pool: antojados (ATLX_ANTOJADOS_APP)

function toBit(value) {
  if (value === undefined || value === null || value === "") return null;
  return value === true || value === 1 || value === "1" || value === "true"
    ? 1
    : 0;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const DEFAULT_SCANNER_SRC = path.resolve(PROJECT_ROOT, "AntojadosMxQuasar/src");
const ENV_SCANNER_SRC = process.env.ANTOJADOS_SCANNER_SRC || "";
const REAL_METADATA_SCANNER = path.resolve(
  PROJECT_ROOT,
  "shared/ui/dimensions/metadataScanner.js",
);

function normalizeUpper(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function buildDimensionTypeFromCode(code) {
  const segments = normalizeUpper(code)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length <= 1) return "MODULE";
  if (segments.length === 2) return "AREA";
  return "COMPONENT";
}

function inferSubType(subCode) {
  const code = normalizeUpper(subCode);
  if (code.includes("FULLSCREEN") || code.endsWith("_PAGE"))
    return "FULLSCREEN";
  if (code.includes("DIALOG")) return "DIALOG";
  if (code.includes("BTN_")) return "BUTTON";
  return "SUBTAB";
}

const LEGACY_ATTR_PATTERN = /\bdata-dim-|\bdata-subdim|\bdata-dimension/i;
const GRANULAR_LEVELS = new Set([
  "SUBTAB",
  "BUTTON",
  "FULLSCREEN",
  "DIALOG",
  "SUB_COMPONENT",
]);
const STRUCTURAL_LEVELS = new Set(["MODULE", "AREA", "COMPONENT"]);
const ANTOJO_ALLOWED_GRANULAR_PARENTS = [
  "ANTOJO.VAS_IR",
  "ANTOJO.ARRE",
];

function getStaticAttrValue(tag, attrName) {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = tag.match(regex);
  return match?.[1] || null;
}

function getObjectStringProp(objectLiteral, propName) {
  const escaped = propName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(?:^|[,{]\\s*)${escaped}\\s*:\\s*(["'])((?:\\\\.|(?!\\1).)*)\\1`,
    "i",
  );
  const match = objectLiteral.match(regex);
  return match?.[2] || null;
}

function extractObjectLiterals(content) {
  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(content.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function normalizeAppliesTo(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "user" || raw === "sponsor" || raw === "all") return raw;
  return "all";
}

function resolveModuleCode(code) {
  return normalizeUpper(code).split(".").filter(Boolean)[0] || null;
}

function isAllowedAntojoGranularParent(parentCode) {
  const normalizedParent = normalizeUpper(parentCode);
  return ANTOJO_ALLOWED_GRANULAR_PARENTS.some(
    (allowed) =>
      normalizedParent === allowed || normalizedParent.startsWith(`${allowed}.`),
  );
}

function buildMetaJson(filePath, sourceType, extras = {}) {
  return JSON.stringify({
    scanner: "antojados-source-scan",
    scanner_mode: "strict-7_2",
    source_type: sourceType,
    source_file: path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/"),
    ...extras,
  });
}

function parseMetadataFromScript(content, filePath) {
  const dimensions = [];
  const subDimensions = [];
  const warnings = [];
  const scriptBlocks = [...content.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];

  for (const block of scriptBlocks) {
    const scriptContent = block[1] || "";
    const objectLiterals = extractObjectLiterals(scriptContent);

    for (const objectLiteral of objectLiterals) {
      const ik = normalizeUpper(getObjectStringProp(objectLiteral, "ik"));
      const pc = normalizeUpper(getObjectStringProp(objectLiteral, "pc"));
      const level = normalizeUpper(getObjectStringProp(objectLiteral, "level"));
      const route =
        getObjectStringProp(objectLiteral, "to") ||
        getObjectStringProp(objectLiteral, "route");
      const label =
        getObjectStringProp(objectLiteral, "label") ||
        getObjectStringProp(objectLiteral, "key") ||
        ik;
      const appliesTo = normalizeAppliesTo(
        getObjectStringProp(objectLiteral, "appliesTo") ||
          getObjectStringProp(objectLiteral, "applies_to"),
      );
      const codeComponent =
        getObjectStringProp(objectLiteral, "codeComponent") ||
        getObjectStringProp(objectLiteral, "code_component");

      const subdimIk = normalizeUpper(
        getObjectStringProp(objectLiteral, "subdimIk") ||
          getObjectStringProp(objectLiteral, "subdim_ik"),
      );
      const subdimPc = normalizeUpper(
        getObjectStringProp(objectLiteral, "subdimPc") ||
          getObjectStringProp(objectLiteral, "subdim_pc"),
      );
      const subdimType = normalizeUpper(
        getObjectStringProp(objectLiteral, "subdimType") ||
          getObjectStringProp(objectLiteral, "subdim_type"),
      );

      if (ik) {
        const isGranularLevel = GRANULAR_LEVELS.has(level);
        if (isGranularLevel) {
          if (!pc) continue;
          const moduleCode = resolveModuleCode(pc);
          if (moduleCode !== "ANTOJO") continue;
          if (!isAllowedAntojoGranularParent(pc)) {
            warnings.push(
              `[scanner] granular fuera de alcance: ${pc}.${ik} (${path
                .relative(PROJECT_ROOT, filePath)
                .replace(/\\/g, "/")})`,
            );
            continue;
          }
          subDimensions.push({
            parent_code: pc,
            sub_code: `${pc}.${ik}`,
            sub_name: label || ik,
            sub_type: level,
            applies_to: appliesTo,
            review_status: "PENDING_REVIEW",
            is_active: 1,
            meta_json: buildMetaJson(filePath, "metadata", {
              level,
              code_component: codeComponent || null,
            }),
          });
        } else {
          // Avoid false positives from local tabs/panels (no route means non-structural in this phase).
          if (!level && !route) continue;
          if (level && !STRUCTURAL_LEVELS.has(level)) continue;

          const normalizedPc = pc === "ROOT" ? "" : pc;
          if (!normalizedPc && level && level !== "MODULE") continue;
          const parentCode = normalizedPc || null;
          const dimensionCode = parentCode ? `${parentCode}.${ik}` : ik;
          dimensions.push({
            dimension_code: dimensionCode,
            parent_code: parentCode,
            dimension_type: level || buildDimensionTypeFromCode(dimensionCode),
            dimension_name: label || ik,
            applies_to: appliesTo,
            review_status: "PENDING_REVIEW",
            is_active: 1,
            meta_json: buildMetaJson(filePath, "metadata", {
              level: level || null,
              code_component: codeComponent || null,
            }),
          });
        }
      }

      if (subdimIk && subdimPc) {
        const moduleCode = resolveModuleCode(subdimPc);
        if (moduleCode === "ANTOJO" && !isAllowedAntojoGranularParent(subdimPc)) {
          warnings.push(
            `[scanner] granular fuera de alcance: ${subdimPc}.${subdimIk} (${path
              .relative(PROJECT_ROOT, filePath)
              .replace(/\\/g, "/")})`,
          );
          continue;
        }
        if (moduleCode !== "ANTOJO") continue;
        subDimensions.push({
          parent_code: subdimPc,
          sub_code: `${subdimPc}.${subdimIk}`,
          sub_name: label || subdimIk,
          sub_type: subdimType || inferSubType(`${subdimPc}.${subdimIk}`),
          applies_to: appliesTo,
          review_status: "PENDING_REVIEW",
          is_active: 1,
          meta_json: buildMetaJson(filePath, "metadata", {
            code_component: codeComponent || null,
          }),
        });
      }
    }
  }

  return { dimensions, subDimensions, warnings };
}

async function walkVueFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkVueFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".vue")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function isDirectory(dirPath) {
  if (!dirPath) return false;
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function resolveScanRoot(scanRoot) {
  const candidates = [
    scanRoot ? path.resolve(scanRoot) : "",
    ENV_SCANNER_SRC ? path.resolve(ENV_SCANNER_SRC) : "",
    DEFAULT_SCANNER_SRC,
    path.resolve(PROJECT_ROOT, "src"),
    path.resolve(PROJECT_ROOT, "../AntojadosMxQuasar/src"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await isDirectory(candidate)) {
      return candidate;
    }
  }

  const err = new Error(
    `scanner source root no existe. Candidatos probados: ${candidates.join(" | ")}`,
  );
  err.status = 500;
  throw err;
}

function parseMetadataFromTemplate(content, filePath) {
  const dimensions = [];
  const subDimensions = [];
  const warnings = [];
  const tags = content.match(/<[^>]+>/g) || [];

  for (const tag of tags) {
    if (LEGACY_ATTR_PATTERN.test(tag)) {
      warnings.push(
        `[scanner] metadata legacy detectada (rechazada): ${path
          .relative(PROJECT_ROOT, filePath)
          .replace(/\\/g, "/")}`,
      );
      continue;
    }

    const ik = normalizeUpper(getStaticAttrValue(tag, "ik"));
    const pc = normalizeUpper(getStaticAttrValue(tag, "pc"));
    if (ik) {
      const parentCode = pc === "ROOT" ? null : pc || null;
      const dimensionCode = parentCode ? `${parentCode}.${ik}` : ik;
      const label = getStaticAttrValue(tag, "label") || ik;
      dimensions.push({
        dimension_code: dimensionCode,
        parent_code: parentCode,
        dimension_type: buildDimensionTypeFromCode(dimensionCode),
        dimension_name: label,
        applies_to: normalizeAppliesTo(getStaticAttrValue(tag, "applies-to")),
        review_status: "PENDING_REVIEW",
        is_active: 1,
        meta_json: buildMetaJson(filePath, "template-static"),
      });
    }

    const subIk = normalizeUpper(getStaticAttrValue(tag, "subdim-ik"));
    const subPc = normalizeUpper(getStaticAttrValue(tag, "subdim-pc"));
    const subType = normalizeUpper(getStaticAttrValue(tag, "subdim-type"));
    if (subIk && subPc) {
      const moduleCode = resolveModuleCode(subPc);
      if (moduleCode !== "ANTOJO") continue;
      if (!isAllowedAntojoGranularParent(subPc)) {
        warnings.push(
          `[scanner] granular fuera de alcance: ${subPc}.${subIk} (${path
            .relative(PROJECT_ROOT, filePath)
            .replace(/\\/g, "/")})`,
        );
        continue;
      }
      const subCode = `${subPc}.${subIk}`;
      subDimensions.push({
        parent_code: subPc,
        sub_code: subCode,
        sub_name: getStaticAttrValue(tag, "label") || subIk,
        sub_type: subType || inferSubType(subCode),
        applies_to: normalizeAppliesTo(
          getStaticAttrValue(tag, "subdim-applies-to"),
        ),
        review_status: "PENDING_REVIEW",
        is_active: 1,
        meta_json: buildMetaJson(filePath, "template-static"),
      });
    }
  }

  return { dimensions, subDimensions, warnings };
}

function dedupeBy(items, keyGetter) {
  const map = new Map();
  for (const item of items) {
    const key = normalizeUpper(keyGetter(item));
    if (!key) continue;
    map.set(key, { ...item });
  }
  return [...map.values()];
}

async function buildScannerPayloadFromSource(scanRoot = DEFAULT_SCANNER_SRC) {
  const vueFiles = await walkVueFiles(scanRoot);
  const dimensions = [];
  const subDimensions = [];
  const warnings = [];

  for (const filePath of vueFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const parsedTemplate = parseMetadataFromTemplate(content, filePath);
    const parsedScript = parseMetadataFromScript(content, filePath);
    dimensions.push(...parsedScript.dimensions, ...parsedTemplate.dimensions);
    subDimensions.push(...parsedScript.subDimensions, ...parsedTemplate.subDimensions);
    warnings.push(...parsedScript.warnings, ...parsedTemplate.warnings);
  }

  // Synthetic-parent generation removed: dims must come only from explicit ik/pc
  // declarations in BarBase components. Sub-dimension parent_codes are sub-catalog
  // context only and must NOT pollute the structural dimensions list.

  return {
    dimensions: dedupeBy(dimensions, (item) => item.dimension_code),
    sub_dimensions: dedupeBy(subDimensions, (item) => item.sub_code),
    source_files: vueFiles.length,
    warnings: [...new Set(warnings)],
  };
}

async function buildScannerPayloadFromRealMetadata() {
  const scanner = await import(pathToFileURL(REAL_METADATA_SCANNER).href);
  if (typeof scanner.buildScannerPayloadFromTabbarbases !== "function") {
    const err = new Error("metadataScanner.js no exporta buildScannerPayloadFromTabbarbases");
    err.status = 500;
    throw err;
  }
  return scanner.buildScannerPayloadFromTabbarbases();
}

/**
 * Procesa el resultado del scanner de dimensiones.
 * Solo inserta dimensiones/sub-dimensiones que aÃºn no existen (PENDING_REVIEW).
 *
 * @param {{ dimensions?: object[], sub_dimensions?: object[] }} payload
 */
async function runScannerFromSource(options = {}) {
  const payload = await buildScannerPayloadFromRealMetadata();
  return {
    inserted_dims: 0,
    inserted_sub_dims: 0,
    scanned_dimensions: payload.dimensions.length,
    scanned_sub_dimensions: payload.sub_dimensions.length,
    source_files: payload.source_files,
    warnings_count: payload.warnings.length,
    warnings: payload.warnings,
    dimensions_snapshot: payload.dimensions,
    sub_dimensions_snapshot: payload.sub_dimensions,
    snapshot_only: true,
  };
}

async function persistScannerSelectionFromSource(options = {}) {
  const payload = await buildScannerPayloadFromRealMetadata();
  const purgeExisting = false;
  const approvedDimensionCodes = new Set(
    (Array.isArray(options?.approved_dimension_codes) ? options.approved_dimension_codes : [])
      .map((code) => normalizeUpper(code))
      .filter(Boolean),
  );
  const approvedSubDimensionCodes = new Set(
    (Array.isArray(options?.approved_sub_dimension_codes) ? options.approved_sub_dimension_codes : [])
      .map((code) => normalizeUpper(code))
      .filter(Boolean),
  );

  if (approvedDimensionCodes.size === 0 && approvedSubDimensionCodes.size === 0) {
    const err = new Error(
      'persistScannerSelectionFromSource: seleccion vacia. Guardar requiere approved_dimension_codes o approved_sub_dimension_codes.',
    );
    err.status = 400;
    throw err;
  }

  const dimensionByCode = new Map(
    payload.dimensions.map((row) => [normalizeUpper(row.dimension_code), row]),
  );

  // Guardar must persist structural parents when a granular sub-dimension is selected.
  for (const row of payload.sub_dimensions) {
    const subCode = normalizeUpper(row.sub_code);
    if (!approvedSubDimensionCodes.has(subCode)) continue;

    const parentCode = normalizeUpper(row.parent_code);
    if (!parentCode) continue;

    const segments = parentCode
      .split('.')
      .map((segment) => String(segment || '').trim())
      .filter(Boolean);

    for (let idx = segments.length; idx > 0; idx -= 1) {
      const candidate = normalizeUpper(segments.slice(0, idx).join('.'));
      if (dimensionByCode.has(candidate)) {
        approvedDimensionCodes.add(candidate);
      }
    }
  }

  const effectivePayload = {
    ...payload,
    dimensions: payload.dimensions
      .filter((row) => approvedDimensionCodes.has(normalizeUpper(row.dimension_code)))
      .map((row) => ({
        ...row,
        review_status: 'APPROVED',
        is_active: 1,
      })),
    sub_dimensions: payload.sub_dimensions
      .filter((row) => approvedSubDimensionCodes.has(normalizeUpper(row.sub_code)))
      .map((row) => ({
        ...row,
        review_status: 'APPROVED',
        is_active: 1,
      })),
  };

  const result = await gtDimensionsResolver.runScanner(effectivePayload, {
    purgeExisting,
  });
  return {
    ...mapRunScannerResult(result),
    scanned_dimensions: payload.dimensions.length,
    scanned_sub_dimensions: payload.sub_dimensions.length,
    persisted_dimensions: Number(result?.inserted_dims || 0),
    persisted_sub_dimensions: Number(result?.inserted_sub_dims || 0),
    source_files: payload.source_files,
    warnings_count: payload.warnings.length,
    warnings: payload.warnings,
    purged_dimensions: Number(result?.purged_dimensions || 0),
    purged_sub_dimensions: Number(result?.purged_sub_dimensions || 0),
    purge_existing: purgeExisting,
  };
}

async function purgeCatalog() {
  const result = await gtDimensionsResolver.purgeCatalog();
  return {
    purged_dimensions: Number(result?.purged_dimensions || 0),
    purged_sub_dimensions: Number(result?.purged_sub_dimensions || 0),
  };
}

async function listDimensions(payload) {
  return mapDimensionsList(await gtDimensionsResolver.listDimensions(payload));
}

async function listSubDimensions(payload) {
  return mapSubDimensionsList(
    await gtDimensionsResolver.listSubDimensions(payload),
  );
}

async function batchApproveDimensions(codes) {
  return mapBatchApproveResult(
    await gtDimensionsResolver.batchApproveDimensions(codes),
  );
}

async function batchApproveSubDimensions(codes) {
  return mapBatchApproveResult(
    await gtDimensionsResolver.batchApproveSubDimensions(codes),
  );
}

async function updateDimensionStatus(code, status) {
  return mapUpdateDimensionStatusResult(
    await gtDimensionsResolver.updateDimensionStatus(code, status),
  );
}

async function updateSubDimensionStatus(code, status) {
  return mapUpdateSubDimensionStatusResult(
    await gtDimensionsResolver.updateSubDimensionStatus(code, status),
  );
}

async function deleteDimension(code) {
  return mapDeleteDimensionResult(
    await gtDimensionsResolver.deleteDimension(code),
  );
}

async function deleteSubDimension(code) {
  return mapDeleteSubDimensionResult(
    await gtDimensionsResolver.deleteSubDimension(code),
  );
}

module.exports = {
  listDimensions,
  listSubDimensions,
  batchApproveDimensions,
  batchApproveSubDimensions,
  updateDimensionStatus,
  updateSubDimensionStatus,
  deleteDimension,
  deleteSubDimension,
  purgeCatalog,
  runScannerFromSource,
  persistScannerSelectionFromSource,
};
