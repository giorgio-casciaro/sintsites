const path = require('path')
const EventEmitter = require('events')
const uuidv4 = require('uuid/v4')
const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
const EMAIL = require('sint-bit-utils/utils/email')
var CONFIG = require('./config')
// var mutationsPack = require('sint-bit-cqrs/mutations')({  mutationsPath: path.join(__dirname, '/mutations')  })
const auth = require('sint-bit-utils/utils/auth')
var hash = require('object-hash')
var netClient

process.env.debugMain = true
// process.env.debugCouchbase = true
// process.env.debugJesus = true
// process.env.debugSchema = true

const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'MAIN', msg, data])) }
const debug = (msg, data) => { if (process.env.debugMain)console.log('\n' + JSON.stringify(['DEBUG', 'MAIN', msg, data])) }
const errorLog = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'MAIN', msg, data])); console.error(data) }
var itemId = (item) => uuidv4()

// const objectHash = function (x) {
//   log('objectHash', x)
//   if (!(x instanceof Object)) return x
//   var array = []
//   for (var p in x) {
//     array.push(p + '_' + objectHash(x[p]))
//    }
//   log('objectHash array', array)
//   return array.sort().join('__')
//  }

// const objectEquals = function( x, y ) {
//   if ( x === y ) return true;
//   if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) return false;
//   if ( x.constructor !== y.constructor ) return false;
//   for ( var p in x ) {
//     if ( ! x.hasOwnProperty( p ) ) continue;
//     if ( ! y.hasOwnProperty( p ) ) return false;
//     if ( x[ p ] === y[ p ] ) continue;
//     if ( typeof( x[ p ] ) !== "object" ) return false;
//     if ( ! Object.equals( x[ p ],  y[ p ] ) ) return false;
//    }
//   for ( p in y ) {
//     if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) return false;
//    }
//   return true;
//  }

var entitySchemaProperties = { }

var defaultResponseSchema = {
  additionalProperties: false,
  properties: {
    __RESULT_TYPE__: { type: 'string' },
    error: { type: 'string' },
    errorType: { type: 'string' },
    errorData: { type: 'object' },
    success: { type: 'string' },
    data: { type: 'object' },
    view: { additionalProperties: false, type: 'object' },
    id: { type: 'string' },
    partial: { type: 'boolean' },
    mutations: {
      type: 'array',
      items: {
        additionalProperties: false,
        type: 'object',
        properties: {
          mutation: { type: 'string' },
          version: { type: 'string' },
          data: { type: 'object' }
        }
      }
    }
  }
  // 'additionalProperties': true
}

var getTokenData = async function (meta = { }) {
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
  var permissionsArray = tokenData.permissions || []
  var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, { [currentValue]: true }), { })
  log('getTokenData', { meta, userId, tokenData, permissionsArray, permissions })
  return { userId, tokenData, permissionsArray, permissions }
}

var serviceAutotest = async function (reqData, meta, getStream) {
  var errors = []
  var testId = uuidv4()

  // getUserByMail
  debug('autotest start ', testId)

  if (errors.length) {
    var testResults = { testId, error: 'test errors', data: errors }
    errorLog('autotest error ', testResults)
    return testResults
  }
  debug('autotest success ', testId)
  return { testId, success: 'all tests passed!' }
}

var serviceStarted = false
var autotestResults = false

var liveSessionListeners = { }
var liveSessions = { }

var filterEvents = function (filterData, eventInfo, serviceInfo, log) {
  log('filterEvents external function', filterData, eventInfo)
  var eventName = eventInfo[0]
  var eventData = eventInfo[1]
  if (eventData.mutation === 'create') return eventInfo
  if (!eventData.mutation || !eventData.objId) return null
  if (!filterData.views) filterData.views = { }
  var viewFields = filterData.views[eventData.objId]
  var mutationName = eventData.mutation + '.' + eventData.version + '.js'
  // log('filterEvents serviceInfo.mutations', serviceInfo.mutations)
  // log('filterEvents mutationName', mutationName)
  var mutationInfo = serviceInfo.mutations[mutationName]
  log('filterEvents mutationInfo', mutationInfo)
  if (viewFields) {
    // console.log('filterEvents serviceInfo.mutations[eventData.mutation]', serviceInfo.mutations[eventData.mutation])
    if (mutationInfo.fieldsWrite.indexOf('*') > -1) return eventInfo
    for (var i in viewFields) {
      if (mutationInfo.fieldsWrite.indexOf(viewFields[i]) > -1) return eventInfo
    }
  }
  return null
}

// -----------------------------------------------------------------

class MainServiceEventsBus extends require('events') {
  constructor (mainServiceName, filterFunc) {
    super()
    this.filterFunc = filterFunc
    this.serviceName = mainServiceName
    this.filterData = { }
    this.filterDataJsonCopy = JSON.stringify(this.filterData)
  }
  async init () {
    this.serviceInfo = await netClient.rpc(this.serviceName, 'serviceInfo', { })
    this.stream = await netClient.rpc(this.serviceName, 'getEvents', { type: 'mutation', filter: this.filterFunc.toString(), filterData: { } }, { }, true, true)
    this.stream.on('data', async (data) => {
      var dataType = ['command', 'event'][data.shift()]
      if (dataType === 'event') { this.emit('remoteEvent', data) }
    })
  }
  updateFilter () {
    // this.filterData = { }
    // this.emit('updateFilter', this.filterData)

    log('filterData', this.filterData)
    log('filterDataJsonCopy', this.filterDataJsonCopy)
    var patch = rfc6902.createPatch(JSON.parse(this.filterDataJsonCopy), this.filterData)
    this.stream.write({ command: 'filterApplyPatch', patch })
    this.filterDataJsonCopy = JSON.stringify(this.filterData)
  }
}

var mainServiceEventsBus = new MainServiceEventsBus('users', filterEvents)
var rfc6902 = require('rfc6902')

class LiveSessionsClass {
  constructor (mainServiceEventsBus, filterEvents) {
    this.sessions = { }
    this.filterEvents = filterEvents
    this.filterData = { views: { } }
    this.mainServiceEventsBus = mainServiceEventsBus
  }
  addSession (session) {
    this.sessions[session.id] = session
    session.filterEvents = this.filterEvents
    session.serviceName = mainServiceEventsBus.serviceName
    session.on('end', () => this.removeSession)
    session.on('commitMonitorViewFields', () => {
      this.mainServiceEventsBus.filterData = this.filterData
      this.mainServiceEventsBus.updateFilter()
    })
    session.on('monitorViewField', (view) => {
      if (!this.filterData.views[view.id]) this.filterData.views[view.id] = []
      if (!this.filterData.views[view.id].includes(view.field)) this.filterData.views[view.id].push(view.field)
    })
    session.on('deleteViewField', (view) => {
      for (var session of this.sessions) {
        for (var query of session.queries) {
          if (query.results && query.results.includes(view.id) && query.request.params.queryParams.fields.includes(view.id)) return false
        }
      }
      var fieldIndex = this.filterData.views[view.id].indexOf(view.field)
      this.filterData.views[view.id].slice(fieldIndex, 1)
      if (!this.filterData.views[view.id].length) delete this.filterData.views[view.id]
    })
  }
  removeSession (session) {
    delete this.sessions[session.id]
  }
}
var allSessions = new LiveSessionsClass(mainServiceEventsBus, filterEvents)
class LiveSessionClass extends require('events') {
  constructor (allSessions) {
    super()
    this.serviceName = false
    this.id = uuidv4()
    this.filterData = { }
    this.eventsQueue = []
    this.sessionListeners = { }
    this.queries = { }
    this.views = { }
    allSessions.addSession(this)
    allSessions.mainServiceEventsBus.on('remoteEvent', async (eventInfo) => {
      var eventName = eventInfo[0]
      var eventData = eventInfo[1]
      log('LiveSessionClass remoteEvent', { eventName, eventData, filterData: this.filterData })
      if (eventName === 'mutation') {
        if (eventData.mutation === 'create') {
          // UPDATE QUERIES
          log('LiveSessionClass UPDATE QUERIES', { eventInfo })
          this.writeEvent(eventName, eventData)
          for (var queryId in this.queries) {
            var query = this.queries[queryId]
            var request = query.request
            request.params.queryParams.idsOnly = true
            let response = await netClient.rpc(this.serviceName, request.params.query, request.params.queryParams, request.meta)
            if (response.results) {
              if (response.results.toString() !== query.viewIds.toString()) {
                for (let viewId of query.viewIds) {
                  if (response.results.indexOf(viewId) < 0) {
                    this.unmonitorViewFields(viewId, request.params.queryParams.fields, true)
                  }
                }
                for (let viewId of response.results) {
                  if (query.viewIds.indexOf(viewId) < 0) {
                    this.monitorViewFields(viewId, request.params.queryParams.fields, true)
                  }
                }
                this.commitMonitorViewFields()
                query.viewIds = response.results
                this.writeEvent('query', { id: query.id, viewIds: query.viewIds })
              }
              // this.queries[request.queryId].isSingleResult = false
              // this.queries[request.queryId].viewIds = []
              // for (var result of response.results) {
              //   this.queries[request.queryId].viewIds.push(result.id)
              //   this.monitorViewFields(result.id, request.params.queryParams.fields)
              //   this.updateViewData(result)
              // }
              // this.commitMonitorViewFields()
            }
          }

        // UPDATE QUERIES
        } else {
          var viewInfo = this.views[eventData.objId]
          if (viewInfo) {
            var mutationFile = eventData.mutation + '.' + eventData.version + '.js'
            var mutationInfo = allSessions.mainServiceEventsBus.serviceInfo.mutations[mutationFile]
            log('LiveSessionClass remoteEvent serviceInfo mutations', { mutationFile, mutationInfo })
            if (mutationInfo.fieldsWrite.indexOf('*') > -1) return this.writeEvent(eventName, eventData)
            for (var i in viewInfo.fields) {
              if (mutationInfo.fieldsWrite.indexOf(viewInfo.fields[i]) > -1) return this.writeEvent(eventName, eventData)
            }
          }
        }
      }
    })
    liveSessions[this.id] = this
  }

  addSessionListener (listener) {
    if (!this.sessionListeners.length) {
      this.eventsQueue.forEach((params) => listener.writeEvent.apply(null, params))
      this.eventsQueue = []
    }
    this.sessionListeners[listener.id] = listener
    listener.on('addedRequest', (request) => this.addRequest(request))
    listener.on('removedRequest', (request) => this.removeQuery(request.queryId))
    listener.on('end', () => this.removeListener(listener))
  }
  removeListener (listener) {
    delete this.sessionListeners[listener.id]
  }
  monitorViewFields (id, fields, load = false) {
    if (!this.views[id]) this.views[id] = { id, fields: [], status: { } }
    fields.forEach(field => {
      if (!this.views[id].fields.includes(field)) {
        this.views[id].fields.push(field)
        this.emit('monitorViewField', { id, field })
      }
    })
  }
  unmonitorViewFields (id, fields, unload = false) {
    var viewInfo = this.views[id]
    if (this.views[id]) delete this.views[id]
    viewInfo.fields.forEach(field => {
      this.emit('unmonitorViewField', { id, field })
    })
  }
  commitMonitorViewFields () {
    this.emit('commitMonitorViewFields', {})
  }
  updateViewData (view) {
    var viewInfo = this.views[view.id]
    var partialView
    for (var field of viewInfo.fields) {
      log('LiveSessionClass updateViewData field', { field, viewStatus: viewInfo.status[field], FU_META: view.VIEW_META.FU_META })
      if (field !== 'VIEW_META') {
        if (!viewInfo.status[field] || viewInfo.status[field] < view.VIEW_META.FU_META[field]) {
          if (!partialView)partialView = { }
          partialView[field] = view[field]
          viewInfo.status[field] = view.VIEW_META.FU_META[field]
        }
      }
    }
    log('LiveSessionClass updateViewData', { viewInfo, view, partialView })
    if (partialView) this.writeEvent('partial_view', partialView)
  }
  removeQuery (queryId) {
    for (var sessionListener of this.sessionListeners) {
      for (var sessionListenerRequest of sessionListener.requests) {
        if (queryId === sessionListenerRequest.queryId) return false
      }
    }
    var query = this.queries[queryId]
    delete this.queries[queryId]
    this.emit('removedQuery', query)
  }
  async checkQuery (query) {
    if (!query.isSingleResult) {
      query.request.params.queryParams.idsOnly = true
      let response = await netClient.rpc(this.serviceName, query.request.query, query.request.params.queryParams, query.request.meta)
      if (query.viewIds.join('|') !== response.results.join('|')) {
        this.writeEvent('query', { id: query.id, results: response.results })
      }
    }
  }
  async addRequest (request) {
    if (!request.queryId) {
      var tokenData = await getTokenData(request.meta)
      request.queryId = hash([request.params, tokenData.userId, tokenData.permissions])
    }
    log('LiveSessionClass addRequest', { id: request.queryId })
    if (!this.queries[request.queryId]) {
      this.queries[request.queryId] = { id: request.queryId, request }
      request.params.queryParams.idsOnly = false
      if (!request.params.queryParams.fields.includes('VIEW_META'))request.params.queryParams.fields.push('VIEW_META')
      if (!request.params.queryParams.fields.includes('id'))request.params.queryParams.fields.push('id')
      if (request.params.queryParams.id) {
        this.queries[request.queryId].isSingleResult = true
        this.queries[request.queryId].viewIds = [request.params.queryParams.id]
        this.monitorViewFields(request.params.queryParams.id, request.params.queryParams.fields)
        this.commitMonitorViewFields()
        let response = await netClient.rpc(this.serviceName, request.params.query, request.params.queryParams, request.meta)
        this.updateViewData(response.view)
      } else {
        let response = await netClient.rpc(this.serviceName, request.params.query, request.params.queryParams, request.meta)
        if (response.results) {
          this.queries[request.queryId].isSingleResult = false
          this.queries[request.queryId].viewIds = []
          for (var result of response.results) {
            this.queries[request.queryId].viewIds.push(result.id)
            this.monitorViewFields(result.id, request.params.queryParams.fields)
            this.updateViewData(result)
          }
          this.commitMonitorViewFields()
        }
      }

      log('LiveSessionClass addedQuery', this.queries[request.queryId])
      this.writeEvent('query', { id: this.queries[request.queryId].id, viewIds: this.queries[request.queryId].viewIds })
    }
  }
  writeEvent (eventName, event) {
    var sessionListener = Object.values(this.sessionListeners)[0]
    log('LiveSessionClass writeEvent', { eventName, event })
    if (sessionListener) sessionListener.writeEvent(eventName, event)
    else this.eventsQueue.push([eventName, event])
  }
  end () {

  }
}

class LiveSessionListenerClass extends require('events') {
  constructor (sessionId, writeEvent, allSessions) {
    super()
    this.id = uuidv4()
    this.canReceiveEvents = true
    this.writeEvent = writeEvent
    this.requests = { }
    if (sessionId) {
      if (liveSessions[sessionId]) this.session = liveSessions[sessionId]
      else throw new Error('session not initialized')
    } else this.session = new LiveSessionClass(allSessions)
    liveSessionListeners[this.id] = this
    this.session.addSessionListener(this)
    writeEvent('listenerId', this.id)
  }
  addRequest (params, meta) {
    var id = uuidv4()
    // var hash = objectHash({  params, userId, permissions  })
    this.requests[id] = { id, params, meta }
    this.emit('addedRequest', this.requests[id])
    return id
  }
  removeRequest (id) {
    var request = this.requests[id]
    delete this.requests[id]
    this.emit('removedRequest', request)
  }
  end () {
    delete liveSessionListeners[this.id]
    this.emit('end', this)
  }
}
var serviceMethods = {
  init: async function (setNetClient) {
    netClient = setNetClient

    var sharedMethods = require('sint-bit-utils/utils/sharedMethods')
    await sharedMethods.init(netClient, serviceMethods)
    for (var i in sharedMethods)serviceMethods[i] = sharedMethods[i]

    await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
    await mainServiceEventsBus.init()
    autotestResults = await serviceAutotest()
    setInterval(async arg => { autotestResults = await serviceAutotest() }, 60000)
    serviceStarted = true
    return true
  },
  autotest: {
    config: { public: false, stream: false, upload: false },
    exec: serviceAutotest
  },
  status: {
    config: { public: false, stream: false, upload: false },
    exec: async function (reqData, meta, getStream) {
      var result = { data: { serviceStarted, autotestResults } }
      if (serviceStarted && autotestResults.success) {
        result.success = 'service status ok'
      } else {
        result.error = 'service can have some problems'
      }
      return result
    }
  },
  serviceInfo: {
    config: { public: true, stream: false, upload: false },
    request: { },
    response: { properties: { 'schema': { type: 'object' }, 'mutations': { type: 'object' } } },
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      log('serviceMethods', serviceMethods)
      var schemaOut = { }
      for (var i in serviceMethods) if (serviceMethods[i].config && serviceMethods[i].config.public) schemaOut[i] = serviceMethods[i].request
      return { schema: schemaOut }
    }
  },
  liveSession: {
    config: { public: true, stream: true, upload: false },
    request: { lastUpdate: { type: 'number' } },
    response: { },
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      /*
      dividere in cache session e live session
      cache session per tenere traccia dei timestamp dei dati presenti nella cache front end (salvata sul db)
        -in alternativa si potrebbe usare un unico timestamp es cacheSessionLastUpdate ed evitare il salvataggio nel db?
      live session per tenere traccia delle richieste registrate dal server
      dovrebbe poter gestire più richieste parallele della stessa cache session (1 computer, molte finestre)
    */
      var writeEvent = (eventName, data) => stream.write('event: ' + eventName + '\ndata: ' + JSON.stringify(data) + '\n\n')

      var stream = getStream()
      log('liveSessionListener connected', { })
      writeEvent('connected', { })

      var liveSessionListener
      if (meta.listenerid) {
        if (liveSessionListeners[meta.listenerid]) {
          liveSessionListener = liveSessionListeners[meta.listenerid]
          liveSessionListener.canReceiveEvents = true
          liveSessionListener.writeEvent = writeEvent
        } else {
          writeEvent('error', 'listener not initialized')
          throw new Error('listener not initialized')
        }
      } else {
        liveSessionListener = new LiveSessionListenerClass(meta.sessionid, writeEvent, allSessions)
      }

      stream.on('end', () => {
        liveSessionListener.canReceiveEvents = false
        setTimeout(() => liveSessionListener.end(), 60000)
      })
    }
  },
  liveSessionCommands: {
    config: { public: false, stream: false, upload: false },
    request: { properties: { commands: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, params: { type: 'object' } }, required: [ 'command', 'params' ] } } }, required: [ 'commands' ] },
    response: { properties: { success: { type: 'string' }, data: { type: 'object' } } },
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var listenerId = meta.listenerid
      var liveSessionListener = liveSessionListeners[listenerId]
      if (!liveSessionListener) throw new Error('listener not initialized')
      log('liveSessionListenerCommands', reqData)
      for (var commandInfo of reqData.commands) {
        if (commandInfo.command === 'addQuery') {
          var queryId = await liveSessionListeners[listenerId].addRequest(commandInfo.params, meta)
          return { success: 'Query Request Added', data: { queryId } }
        }
        if (commandInfo.command === 'emitEvent') {
          mainServiceEventsBus.emit('remoteEvent', [commandInfo.params.eventName, commandInfo.params.event])
          return { success: 'mainServiceEventsBus emitted Event' }
        }
      }
      return { success: 'liveSessionCommands accepted' }
    }
  }
}
module.exports = serviceMethods
