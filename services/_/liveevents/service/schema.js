var jsFields = require('sint-bit-utils/utils/JSchemaFields')
var ip = require('./getIp')
var toBool = (string, defaultVal = false) => {
  if (typeof string === 'undefined') return defaultVal
  if (typeof string === 'boolean') return string
  if (typeof string === 'string' && string === 'true') return true
  return false
}
// var jsCanReq = { properties: { data: { type: 'object' } } }
// var jsCanRes = { properties: { success: { type: 'string' }, error: { type: 'string' } } }

module.exports = {
  net: {
    'channels': {
      'httpPublic': {
        'url': `${ip}:${process.env.netHostHttpPublicPort || '10080'}`,
        'cors': process.env.netCors || ip || '127.0.0.1'
      },
      'http': { 'url': `${ip || '127.0.0.1'}:${process.env.netHostHttpPort || '10081'}` }
    }
  },
  exportToPublicApi: toBool(process.env.exportToPublicApi, true),
  rpcOut: {
    'readSubscription': {
      to: 'dashboards',
      method: 'subscriptionsReadByDashIdAndUserId',
      requestSchema: {'type': 'object'},
      responseSchema: {'type': 'object'}
    }
  },
  eventsIn: {
    'NOTIFICATIONS_ENTITY_MUTATION': {
      method: 'triggerEvent'
    }
  },
  eventsOut: {},
  methods: {
    'testEvent': {
      public: false,
      responseType: 'response',
      requestSchema: {'additionalProperties': true, properties: {}},
      responseSchema: {'additionalProperties': true, properties: {}}
    },
    'triggerEvent': {
      public: false,
      responseType: 'response',
      requestSchema: {properties: {id: {'type': 'string'}, data: {'type': 'object'}, filters: {'type': 'object'}}},
      responseSchema: {'additionalProperties': true, properties: {}}
    },
    'getEvents': {
      public: true,
      responseType: 'stream',
      requestSchema: { properties: { timeout: {'type': 'number'} } },
      responseSchema: false
      // requestSchema: {'additionalProperties': true, properties: {}},
      // responseSchema: {'additionalProperties': true, properties: {}}
    }
  }
}
