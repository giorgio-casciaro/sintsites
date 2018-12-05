var maps = {
  description: 'maps info',
  type: 'array',
  items: {
    type: 'object',
    properties: {
      centerLat: { type: 'number' },
      centerLng: { type: 'number' },
      zoom: { type: 'number' }
    },
    required: ['centerLat', 'centerLng']
  }
}
var pic = {
  type: 'object',
  properties: { sizes: { type: 'array' }, picId: { type: 'string' } },
  required: ['picId', 'sizes']
}
var picFile = { type: 'object', properties: { mimetype: { type: 'string' }, path: { type: 'string' } }, required: ['path'] }
var pics = { type: 'object', additionalProperties: pic }
var tags = {
  description: 'tags',
  type: 'array',
  'default': [],
  items: {
    type: 'string', 'minLength': 3, 'maxLength': 50
  }
}
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
}
var meta = {
  confirmed: { type: 'boolean' },
  deleted: { type: 'boolean' },
  updated: { type: 'number' },
  created: { type: 'number' }
}
var jsProp = { id: {type: 'string'}, name: { type: 'string' }, description: { type: 'string' }, options: { type: 'object' }, tags, maps, public: { type: 'boolean' }, pics, meta, roles: {type: 'object'} }
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
  rpcOut: {
    'readDashboard': {
      to: 'dashboards',
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
        properties: {items: {type: 'array', items: {type: 'object', properties: jsProp, required: [ 'name' ]}}, extend: jsEntity},
        required: [ 'items' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'rawMutateMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: {mutation: {type: 'string'}, items: {type: 'array', items: {type: 'object', properties: {data: jsEntity, id: { type: 'string' }}}}, extend: jsEntity},
        required: [ 'items', 'mutation' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'updateMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: {items: {type: 'array', items: jsEntity}, extend: jsEntity},
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
      responseSchema: {properties: {results: {type: 'array', items: jsEntity}, errors: {type: 'array'}}}
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
        properties: {items: {type: 'array', items: jsEntity}, extend: jsEntity},
        required: [ 'items' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'removeTagsMulti': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: {items: {type: 'array', items: jsEntity}, extend: jsEntity},
        required: [ 'items' ]
      },
      responseSchema: {properties: {results: {type: 'array', items: jsRes}, errors: {type: 'array'}}}
    },
    'list': {
      public: true,
      responseType: 'response',
      requestSchema: { properties: { from: { type: 'integer' }, to: { type: 'integer' } } },
      responseSchema: {properties: {results: {type: 'array', items: jsEntity}, errors: {type: 'array'}}}
    },
    'addPic': {
      public: true,
      responseType: 'response',
      requestSchema: {
        properties: { id: {type: 'string'}, pic: picFile },
        required: [ 'id', 'pic' ]
      },
      responseSchema: false
    },
    'getPic': {
      public: true,
      responseType: 'response',
      requestSchema: { properties: { id: {type: 'string'}, size: {type: 'string'} }, required: [ 'id' ] },
      responseSchema: false
    },
    'deletePic': {
      public: true,
      responseType: 'response',
      requestSchema: { properties: { id: {type: 'string'} }, required: [ 'id' ] },
      responseSchema: false
    }

  }
}
