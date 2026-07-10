'use strict';

const INSTANCE_TYPE = Object.freeze({
  USER:    'user',
  SPONSOR: 'sponsor',
});

const SCOPE_TYPE = Object.freeze({
  USER:    'user',
  SPONSOR: 'sponsor',
  ALL:     'all',
});

module.exports = { INSTANCE_TYPE, SCOPE_TYPE };
