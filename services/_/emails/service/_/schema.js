var toBool = (string, defaultVal = false) => {
  if (typeof string === 'undefined') return defaultVal
  if (typeof string === 'boolean') return string
  if (typeof string === 'string' && string === 'true') return true
  return false
}

var jsRes = {
  properties: {
    success: { type: 'string' },
    error: { type: 'string' },
    data: { type: 'object' },
    method: { type: 'string' },
    type: { type: 'string' },
    id: { type: 'string' }
  }
  // 'additionalProperties': true
}
var jsPropTemplate = {id: {type: 'string'}, html: { type: 'string' }, text: { type: 'string' }, subject: { type: 'string' }}
var jsProp = {id: {type: 'string'}, email: {type: 'string'}, confirmed: { type: 'boolean' }, deleted: { type: 'boolean' }, updated: { type: 'number' }, created: { type: 'number' }, template: { type: 'string' }, templateRaw: jsPropTemplate, data: { type: 'object' }}
var jsEntity = {type: 'object', properties: jsProp}
module.exports = {
  net: {
    'channels': {
      'httpPublic': {
        'url': `${process.env.netHost || '127.0.0.1'}:${process.env.netHostHttpPublicPort || '10080'}`,
        'cors': process.env.netCors || process.env.netHost || '127.0.0.1'
      },
      'http': { 'url': `${process.env.netHost || '127.0.0.1'}:${process.env.netHostHttpPort || '10081'}` }
    }
  },
  exportToPublicApi: toBool(process.env.exportToPublicApi, true),
  rpcOut: {},
  eventsIn: {},
  eventsOut: {},
  methods: {
    'serviceInfo': {
      public: true,
      responseType: 'response',
      requestSchema: {},
      responseSchema: {properties: {'schema': {type: 'object'}, 'mutations': {type: 'object'}}}
    },
    'registerTemplates': {
      public: false,
      responseType: 'response',
      requestSchema: {
        properties: {items: {type: 'array', items: {type: 'object', properties: jsPropTemplate, required: [ 'subject', 'html', 'text', 'id' ]}}, extend: {properties: jsPropTemplate}},
        required: [ 'items' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'addToQueueMulti': {
      public: false,
      responseType: 'response',
      requestSchema: {
        properties: {items: {type: 'array', items: {type: 'object', properties: jsProp, required: [ 'email' ]}}, extend: jsEntity},
        required: [ 'items' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    }
  }
}
