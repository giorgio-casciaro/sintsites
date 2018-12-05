var toBool = (string, defaultVal = false) => {
  if (typeof string === 'undefined') return defaultVal
  if (typeof string === 'boolean') return string
  if (typeof string === 'string' && string === 'true') return true
  return false
}
var jsFields = require('sint-bit-utils/utils/JSchemaFields')
var postId = { type: 'string' }
var dashId = { type: 'string' }
var roleId = { type: 'string' }
var userId = { type: 'string' }
var location = { type: 'array', items: { type: 'object', properties: { lat: {type: 'number'}, lng: {type: 'number'} }, required: ['lat', 'lng'] } }
var pics = { type: 'array', items: { type: 'string' } }

var jsRes = {
  properties: {
    success: { type: 'boolean' },
    error: { type: 'string' },
    data: { type: 'object' },
    method: { type: 'string' },
    type: { type: 'string' },
    id: { type: 'string' }
  }
  // 'additionalProperties': true
}

var meta = {
  confirmed: { type: 'boolean' },
  deleted: { type: 'boolean' },
  updated: { type: 'number' },
  created: { type: 'number' }
}
// var jsProp = { id: postId, dashId: dashId, roleId, tags: jsFields.tags, userId: { type: 'string' }, meta, notifications: { type: 'array' }, role: { type: 'object' } }
var jsProp = { id: postId, name: { type: 'string' }, userId, subscription: { type: 'object' }, dashId, public: { type: 'boolean' }, body: { type: 'string' }, location, tags: jsFields.tags, toTags: { type: 'array', items: { type: 'string' } }, toRoles: { type: 'array', items: { type: 'string' } }, pics, meta, user: { type: 'object' }, readedByUser: { type: 'boolean' }, notifications: { type: 'array' } }

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
  rpcOut: {
    'readUser': {
      to: 'users',
      method: 'read',
      requestSchema: {'type': 'object'},
      responseSchema: {'type': 'object'}
    }
  },
  eventsIn: {
  },
  eventsOut: {
  },
  methods: {
    'serviceInfo': {
      public: true,
      responseType: 'response',
      requestSchema: {},
      responseSchema: {properties: {'schema': {type: 'object'}, 'mutations': {type: 'object'}}}
    },
    'createMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: {items: {type: 'array', items: {type: 'object', properties: jsProp, required: [ 'body' ]}}, extend: jsProp},
        required: [ 'items' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'rawMutateMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: {mutation: {type: 'string'}, items: {type: 'array', items: {type: 'object', properties: {data: jsProp, id: { type: 'string' }}}}, extend: jsProp},
        required: [ 'items', 'mutation' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'updateMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: {items: {type: 'array', items: jsProp}, extend: jsProp},
        required: [ 'items' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'readMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: [ 'ids' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsProp}, errors: {type: 'array'}}}
    },
    'deleteMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: [ 'ids' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'confirmMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: [ 'ids' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'addTagsMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: {items: {type: 'array', items: jsProp}, extend: jsProp},
        required: [ 'items' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'removeTagsMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: {items: {type: 'array', items: jsProp}, extend: jsProp},
        required: [ 'items' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'list': {
      public: true,
      responseType: 'response',
      requestSchema: { required: ['dashId'], properties: { dashId, from: { type: 'integer' }, to: { type: 'integer' } } },
      responseSchema: {properties: {results: {type: 'array', items: jsProp}, errors: {type: 'array'}}}
    },
    'listByDashIdTagsRoles': {
      public: true,
      responseType: 'response',
      requestSchema: { required: ['dashId'], properties: { dashId, roles: { type: 'array' }, tags: { type: 'array' } } },
      responseSchema: {properties: {results: {type: 'array', items: jsProp}, errors: {type: 'array'}}}
    }
  }
}
