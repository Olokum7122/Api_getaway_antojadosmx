'use strict';
const gtModerationResolver = require('./gt-moderationResolver');
const {
  mapQueueList,
  mapModerationActionResult,
  mapSubmitToQueueResult,
} = require('./gt-moderationMapper');

async function getQueue(payload) {
  return mapQueueList(await gtModerationResolver.getQueue(payload));
}

async function approveContent(contentType, contentId, payload) {
  return mapModerationActionResult(await gtModerationResolver.approveContent(contentType, contentId, payload));
}

async function rejectContent(contentType, contentId, payload) {
  return mapModerationActionResult(await gtModerationResolver.rejectContent(contentType, contentId, payload));
}

async function submitToQueue(sponsorBizId, payload) {
  return mapSubmitToQueueResult(await gtModerationResolver.submitToQueue(sponsorBizId, payload));
}

module.exports = { getQueue, approveContent, rejectContent, submitToQueue };
