'use strict';
const gtTemplatesResolver = require('./gt-templatesResolver');
const {
  mapTemplateSummaryList,
  mapTemplateDetail,
  mapTemplateRebuildResult,
  mapTemplateUpdateResult,
} = require('./gt-templatesMapper');

async function listTemplates(payload) {
  return mapTemplateSummaryList(await gtTemplatesResolver.listTemplates(payload));
}

async function getTemplate(templateCode, payload) {
  return mapTemplateDetail(await gtTemplatesResolver.getTemplate(templateCode, payload));
}

async function rebuildTemplate(templateCode, payload) {
  return mapTemplateRebuildResult(await gtTemplatesResolver.rebuildTemplate(templateCode, payload));
}

async function updateTemplateLocation(templateLocationId, payload) {
  return mapTemplateUpdateResult(await gtTemplatesResolver.updateTemplateLocation(templateLocationId, payload));
}

async function updateTemplateSubLocation(templateSubLocationId, payload) {
  return mapTemplateUpdateResult(await gtTemplatesResolver.updateTemplateSubLocation(templateSubLocationId, payload));
}

module.exports = {
  listTemplates,
  getTemplate,
  rebuildTemplate,
  updateTemplateLocation,
  updateTemplateSubLocation,
};
