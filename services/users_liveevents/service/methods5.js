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
  if (eventData.mutation === 'confirmEmail') return eventInfo
  if (!eventData.mutation || !eventData.objId) return null
  if (!filterData.views) filterData.views = []
  if (filterData.views.indexOf(eventData.objId) > -1) return eventInfo
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
    this.filterData = { views: [], queryTypes: [] }
    this.views = { }
    this.queryTypes = { }
    this.mainServiceEventsBus = mainServiceEventsBus
  }
  addSession (session) {
    this.sessions[session.id] = session
    session.filterEvents = this.filterEvents
    session.serviceName = mainServiceEventsBus.serviceName
    session.on('end', () => this.removeSession)
    session.on('commitMonitorView', () => {
      this.filterData = { views: Object.keys(this.views), queryTypes: Object.keys(this.queryTypes) }
      this.mainServiceEventsBus.filterData = this.filterData
      this.mainServiceEventsBus.updateFilter()
    })
    session.on('monitorView', (viewId) => {
      if (!this.views[viewId]) this.views[viewId] = [session.id]
      else this.views[viewId].push(session.id)
    })
    session.on('unmonitorView', (viewId) => {
      this.views[viewId].splice(this.views[viewId].indexOf(session.id), 1)
      if (!this.views[viewId].length) delete this.views[viewId]
    })
    session.on('monitorQuery', (queryType) => {
      if (!this.queryTypes[queryType]) this.queryTypes[queryType] = [session.id]
      else this.queryTypes[queryType].push(session.id)
    })
    session.on('unmonitorQuery', (queryType) => {
      this.queryTypes[queryType].splice(this.queryTypes[queryType].indexOf(session.id), 1)
      if (!this.queryTypes[queryType].length) delete this.queryType[queryType]
    })
  }
  removeSession (session) {
    delete this.sessions[session.id]
  }
}
var allSessions = new LiveSessionsClass(mainServiceEventsBus, filterEvents)
class LiveSessionClass extends require('events') {
  async init (sessionId, allSessions) {
    // super()
    this.serviceName = false
    this.garbageCollectionCleanPercent = 50
    if (sessionId) var dbSession = await DB.get(sessionId)
    if (dbSession) {
      log('LiveSessionClass from DB', dbSession)
      this.id = sessionId
      this.queries = dbSession.queries
      this.views = dbSession.views
    } else {
      this.id = uuidv4()
      this.queries = {}
      this.views = { }
    }
    this.filterData = { }
    this.eventsQueue = []
    this.sessionListeners = { }
    this.maxQueries = 100
    this.maxViews = 200
    allSessions.addSession(this)
    this.writeEvent('sessionId', this.id)

    allSessions.mainServiceEventsBus.on('remoteEvent', async (eventInfo) => {
      var eventName = eventInfo[0]
      var eventData = eventInfo[1]
      log('LiveSessionClass remoteEvent', { eventName, eventData, filterData: this.filterData })
      if (eventName === 'mutation') {
        var viewInfo = this.views[eventData.objId]
        var eventSended = false
        var sendEvent = () => {
          log('LiveSessionClass remoteEvent sendEvent', { eventName, eventData })
          if (!eventSended) this.writeEvent(eventName, eventData)
          eventSended = true
        }
        log('LiveSessionClass remoteEvent UPDATE viewInfo', viewInfo)
        if (viewInfo) {
          var mutationFile = eventData.mutation + '.' + eventData.version + '.js'
          var mutationInfo = allSessions.mainServiceEventsBus.serviceInfo.mutations[mutationFile]
          log('LiveSessionClass remoteEvent serviceInfo mutations', { mutationFile, mutationInfo })
          if (mutationInfo.fieldsWrite.indexOf('*') > -1) sendEvent()
          else {
            for (var i in viewInfo.fields) {
              if (mutationInfo.fieldsWrite.indexOf(viewInfo.fields[i]) > -1) sendEvent(eventName, eventData)
            }
          }
        }
        // UPDATE QUERIES
        log('LiveSessionClass remoteEvent UPDATE QUERIES', this.queries)
        for (var queryId in this.queries) {
          var query = this.queries[queryId]
          if (query.monitor) {
          // var liveQueryUpdate = allSessions.mainServiceEventsBus.serviceInfo.liveQueries[query.query]
            if (query.liveQueryUpdate)log('LiveSessionClass remoteEvent UPDATE QUERIES liveQueryUpdate', { eventData, liveQueryUpdate: query.liveQueryUpdate.toString() })
            if (query.liveQueryUpdate && query.liveQueryUpdate(eventData, query)) {
              sendEvent()
              await this.updateQuery(query)
            }
          }
        }
        this.commitMonitorView()
      }
    })

    liveSessions[this.id] = this
  }

  addSessionListener (listener) {
    this.sessionListeners[listener.id] = listener
    // listener.on('addedRequest', (request) => this.addedRequest(request))
    // listener.on('removedRequest', (request) => this.removedRequest(request))
    // listener.on('end', () => this.removedListener(listener))
    this.flushEventsQueue()
  }

  removedListener (listener) {
    delete this.sessionListeners[listener.id]
    if (Object.keys(this.sessionListeners).length === 0) this.end()
  }
  async monitorView (queryId, id, fields, load = false) {
    fields = fields.slice()
    log('monitorView', { queryId, id, fields })
    var view = this.views[id]
    if (!view) {
      view = this.views[id] = { id, fields, fieldQueries: {}, status: { } }
      fields.forEach(field => (view.fieldQueries[field] = [queryId]))
    } else {
      fields.forEach(field => {
        if (!view.fieldQueries[field]) {
          view.fieldQueries[field] = []
        }
        if (view.fields.indexOf(field) === -1)view.fields.push(field)
        if (view.fieldQueries[field].indexOf(queryId) === -1)view.fieldQueries[field].push(queryId)
      })
    }
    if (!view.monitor) {
      view.monitor = true
      this.emit('monitorView', id)
      if (load) {
        // LOAD AN UNMONITORED VIEW
        let fieldsToLoad = fields.slice()
        fieldsToLoad.push('VIEW_META')
        let response = await netClient.rpc(this.serviceName, 'read', { id, fields: fieldsToLoad }, this.queries[queryId].request.meta)
        this.updateViewData(response.view, id)
      }
    } else {
      if (load) {
        // LOAD A MONITORED VIEW
        var statusKeys = Object.keys(view.status)
        let fieldsToLoad = fields.filter(field => !statusKeys.includes(field))
        if (fieldsToLoad.length) {
          fieldsToLoad.push('VIEW_META')
          let response = await netClient.rpc(this.serviceName, 'read', { id, fields: fieldsToLoad }, this.queries[queryId].request.meta)
          this.updateViewData(response.view, id)
        }
      }
    }
  }
  unmonitorView (queryId, id, fields) {
    fields = fields.slice()
    var view = this.views[id]
    fields.forEach(field => {
      view.fieldQueries[field].splice(view.fieldQueries[field].indexOf(queryId), 1)
      if (!view.fieldQueries[field].length)view.fields.splice(view.fields.indexOf(field), 1)
    })
    if (!view.fields.length) {
      // delete this.views[id]
      // this.writeEvent('viewRemoved', { id })
      log('unmonitorView', view)
      view.monitor = false
      view.unMonitorTimestamp = Date.now()
      this.emit('unmonitorView', id)
    }
  }
  commitMonitorView () {
    this.emit('commitMonitorView', {})
  }
  updateViewData (view, viewId) {
    var viewInfo = this.views[viewId || view.id]
    log('LiveSessionClass updateViewData', { view, viewInfo })
    var partialView = { id: viewId || view.id }
    var partialViewPopulated = false
    for (var field of viewInfo.fields) {
      log('LiveSessionClass updateViewData field', { field, viewStatus: viewInfo.status[field], FU_META: view.VIEW_META.FU_META })
      if (field !== 'VIEW_META') {
        if (!viewInfo.status[field] || viewInfo.status[field] < view.VIEW_META.FU_META[field]) {
          if (!partialView)partialView = { }
          partialView[field] = view[field]
          partialViewPopulated = true
          viewInfo.status[field] = view.VIEW_META.FU_META[field]
        }
      }
    }
    log('LiveSessionClass updateViewData', { viewInfo, view, partialView })
    if (partialViewPopulated) this.writeEvent('partial_view', partialView)
  }

  async updateQuery (query, reloadAllViewsData) {
    log('LiveSessionClass updateQuery', query)
    var queryParams = Object.assign({}, query.request.params.queryParams, { idsOnly: true })

    if (query.isSingleResult) {
      await this.monitorView(query.id, queryParams.id, query.fields, true)
    } else {
      // queryParams.fields = query.request.params.queryParams.fields.slice()
      // if (!queryParams.fields.includes('VIEW_META'))queryParams.fields.push('VIEW_META')
      // if (!queryParams.fields.includes('id'))queryParams.fields.push('id')
      log('LiveSessionClass updateQuery request', { serviceName: this.serviceName, query: query.request.params.query, queryParams: queryParams })
      let response = await netClient.rpc(this.serviceName, query.request.params.query, queryParams, query.request.meta)
      if (response.ids) {
        if (response.ids.toString() !== query.viewIds.toString()) {
          log('LiveSessionClass updateQuery response', response)
          for (let viewId of query.viewIds) if (response.ids.indexOf(viewId) < 0) await this.unmonitorView(query.id, viewId, query.fields)
          for (let viewId of response.ids) await this.monitorView(query.id, viewId, query.fields, true)
          query.viewIds = response.ids

          this.writeEvent('query', { id: query.id, viewIds: query.viewIds })
        }
      }
    }
  }

  // async checkQuery (query) {
  //   if (!query.isSingleResult) {
  //     query.request.params.queryParams.idsOnly = true
  //     let response = await netClient.rpc(this.serviceName, query.request.query, query.request.params.queryParams, query.request.meta)
  //     if (query.viewIds.join('|') !== response.results.join('|')) {
  //       this.writeEvent('query', { id: query.id, results: response.results })
  //     }
  //   }
  // }
  async addedRequest (request) {
    log('LiveSessionClass addedRequest', request)
    if (!request.queryId) {
      var tokenData = await getTokenData(request.meta)
      request.queryId = hash([request.params, tokenData.userId, tokenData.permissions])
    }
    log('LiveSessionClass addedRequest', { id: request.queryId, query: this.queries[request.queryId] })
    if (!this.queries[request.queryId]) {
      this.queries[request.queryId] = await this.createQuery(request)
    } else {
      this.queries[request.queryId].requests.push(request.id)
      let query = this.queries[request.queryId]
      if (!query.monitor) {
        log('LiveSessionClass query present but not monitored', query)
        query.monitor = true
         // for (let viewId of query.viewIds) await this.monitorView(query.id, viewId, query.fields, false)
        // await this.commitMonitorView()
        await this.updateQuery(query, true)
        await this.garbageCollection()
      }
    }

    return request.queryId
  }
  async garbageCollection (maxViews, maxQueries) {
    var queriesArray = Object.values(this.queries)
    log('LiveSessionClass garbageCollection', { queriesNumber: queriesArray.length, maxQueries: maxQueries })
    if (queriesArray.length > maxQueries || this.maxQueries) {
      var unmonitoredQueriesArray = queriesArray.filter((query) => !query.monitor)
      log('LiveSessionClass garbageCollection unmonitoredQueriesArray', { unmonitoredQueriesArray })
      if (unmonitoredQueriesArray.length) {
        let maxQueries = Math.round(unmonitoredQueriesArray.length / 100 * this.garbageCollectionCleanPercent)
        var unmonitoredQueriesToRemoveArray = unmonitoredQueriesArray.sort(function (a, b) {
          return a.unmonitorTimestamp - b.unmonitorTimestamp
        }).slice(maxQueries * -1)
        log('LiveSessionClass garbageCollection unmonitoredQueriesToRemoveArray', { unmonitoredQueriesToRemoveArray })
        unmonitoredQueriesToRemoveArray.forEach((query) => {
          delete this.queries[query.id]
          this.writeEvent('queryRemoved', { id: query.id })
        })
      }
    }
    var viewsArray = Object.values(this.views)
    if (viewsArray.length > maxViews || this.maxViews) {
      var unmonitoredViewsArray = viewsArray.filter((view) => !view.monitor)
      log('LiveSessionClass garbageCollection unmonitoredViewsArray', { unmonitoredViewsArray })
      if (unmonitoredViewsArray.length) {
        let maxViews = Math.round(unmonitoredViewsArray.length / 100 * this.garbageCollectionCleanPercent)
        var unmonitoredViewsToRemoveArray = unmonitoredViewsArray.sort(function (a, b) {
          return a.unmonitorTimestamp - b.unmonitorTimestamp
        }).slice(maxViews * -1)
        log('LiveSessionClass garbageCollection unmonitoredViewsToRemoveArray', { unmonitoredViewsToRemoveArray })
        unmonitoredViewsToRemoveArray.forEach((view) => {
          delete this.views[view.id]
          this.writeEvent('viewRemoved', { id: view.id })
        })
      }
    }
  }
  async createQuery (request) {
    var query = { id: request.queryId, request, monitor: true, fields: request.params.queryParams.fields.slice(), requests: [request.id] }
    var queryParams = Object.assign({}, request.params.queryParams, { idsOnly: false })
    queryParams.fields = request.params.queryParams.fields.slice()
    if (!queryParams.fields.includes('VIEW_META'))queryParams.fields.push('VIEW_META')
    if (!queryParams.fields.includes('id'))queryParams.fields.push('id')
    if (queryParams.id) {
      query.isSingleResult = true
      query.viewIds = [queryParams.id]
      this.monitorView(query.id, queryParams.id, query.fields, false)
      this.commitMonitorView()
      log('LiveSessionClass createQuery queryParams', queryParams)
      let response = await netClient.rpc(this.serviceName, request.params.query, queryParams, request.meta)
      log('LiveSessionClass createQuery response', response)
      if (response.__RESULT_TYPE__ !== 'error') this.updateViewData(response.view, response.id)
      else {
        log('Query response error', { serviceName: this.serviceName, query: request.params.query, queryParams, response })
        throw Object.assign(new Error('Query response error: ' + response.error), { type: 'query', data: { queryId: query.id, queryParams } })
        // this.writeEvent('error', { errorType: 'query', error: 'Query response error: ' + response.error, errorData: { queryId: query.id, queryParams } })
      }
    } else {
      log('LiveSessionClass createQuery queryParams', queryParams)
      let response = await netClient.rpc(this.serviceName, request.params.query, queryParams, request.meta)
      log('LiveSessionClass createQuery response', response)
      if (response.__RESULT_TYPE__ !== 'error') {
        query.isSingleResult = false
        query.viewIds = []
        for (var result of response.results) {
          query.viewIds.push(result.id)
          await this.monitorView(query.id, result.id, query.fields, false)
          this.updateViewData(result, result.id)
        }
        this.commitMonitorView()
      } else {
        log('Query response error', { serviceName: this.serviceName, query: request.params.query, queryParams, response })
        throw Object.assign(new Error('Query response error: ' + response.error), { type: 'query', data: { queryId: query.id, queryParams } })
        // this.writeEvent('error', { errorType: 'query', error: 'Query response error: ' + response.error, errorData: { queryId: query.id, queryParams } })
      }
      await this.garbageCollection()
    }
    // log('allSessions.mainServiceEventsBus.serviceInfo', allSessions.mainServiceEventsBus.serviceInfo)
    if (allSessions.mainServiceEventsBus.serviceInfo.liveQueries[request.params.query]) {
      var vm = require('vm')
      const sandbox = { func: false }
      vm.createContext(sandbox)
      vm.runInContext('func = ' + allSessions.mainServiceEventsBus.serviceInfo.liveQueries[request.params.query], sandbox)
      query.liveQueryUpdate = sandbox.func
    }
    log('LiveSessionClass createQuery', query)
    this.writeEvent('query', { id: query.id, viewIds: query.viewIds })
    return query
  }
  async removedRequest (request, commit = true) {
    let query = this.queries[request.queryId]
    log('removedRequest query.requests', query.requests)
    log('removedRequest request.id', request.id)
    log('removedRequest query.requests.indexOf(request.id)', query.requests.indexOf(request.id))
    query.requests.splice(query.requests.indexOf(request.id), 1)
    log('removedRequest query.requests', { requests: query.requests, isEmpty: !query.requests, isEmpty2: !query.requests.length })
    if (!query.requests.length) {
      for (let viewId of query.viewIds) this.unmonitorView(query.id, viewId, query.fields)
      query.monitor = false
      query.unMonitorTimestamp = Date.now()
      log('unmonitorQuery', query)
      // delete this.queries[request.queryId]
      // this.writeEvent('queryRemoved', { id: query.id })
      return request.queryId
    }
    if (commit) this.commitMonitorView()
    return false
  }
  flushEventsQueue (listener) {
    log('flushEventsQueue', this.eventsQueue)
    if (this.eventsQueue.length) {
      for (let listenerId in this.sessionListeners) {
        if (this.sessionListeners[listenerId].canReceiveEvents) {
          this.eventsQueue.forEach((params) => this.sessionListeners[listenerId].writeEvent.apply(null, params))
          this.eventsQueue = []
          return true
        }
      }
    }
    return false
  }
  writeEvent (eventName, event) {
    for (let listenerId in this.sessionListeners) {
      if (this.sessionListeners[listenerId].canReceiveEvents) {
        this.sessionListeners[listenerId].writeEvent(eventName, event)
        log('LiveSessionClass writeEvent', { listenerId, eventName, event })
        return true
      }
    }
    this.eventsQueue.push([eventName, event])
    log('writeEvent eventsQueue', this.eventsQueue)
  }
  async end () {
    log('LiveSessionClass end', { id: this.id, queries: this.queries, views: this.views })
    await DB.put('session', { views: this.views, queries: this.queries }, this.id)
    this.commitMonitorView()
    delete liveSessions[this.id]
  }
}

class LiveSessionListenerClass extends require('events') {
  async init (sessionId, writeEvent, allSessions) {
    // super()
    this.id = uuidv4()
    this.canReceiveEvents = true
    this.keepAlive = 10
    this.writeEvent = writeEvent
    this.requests = { }
    log('LiveSessionListenerClass session', { sessionId, liveSessions: Object.keys(liveSessions) })
    if (sessionId && liveSessions[sessionId]) {
      if (liveSessions[sessionId]) this.session = liveSessions[sessionId]
    } else {
      this.session = new LiveSessionClass()
      await this.session.init(sessionId, allSessions)
    }
    liveSessionListeners[this.id] = this
    this.session.addSessionListener(this)
    writeEvent('listenerId', this.id)
  }
  async addRequest (params, meta) {
    var id = uuidv4()
    // var hash = objectHash({  params, userId, permissions  })
    var request = this.requests[id] = { id, params, meta }
    // this.emit('addedRequest', this.requests[id])
    var queryId = await this.session.addedRequest(request)
    return { requestId: id, queryId }
  }
  async removeRequest (id, commit = true) {
    var request = this.requests[id]
    delete this.requests[id]
    var removedQueryId = await this.session.removedRequest(request, commit)
    return { requestId: id, removedQueryId }
  }
  async disconnect (id) {
    log('LiveSessionListenerClass disconnect')
    this.canReceiveEvents = false
    this.timeout = setTimeout(() => this.end(), this.keepAlive * 1000)
  }
  async reconnect (writeEvent) {
    log('LiveSessionListenerClass reconnect')

    this.canReceiveEvents = true
    if (this.timeout)clearTimeout(this.timeout)
    this.writeEvent = writeEvent
    this.session.flushEventsQueue()
  }
  async end () {
    log('LiveSessionListenerClass end')
    for (let requestId in this.requests) await this.removeRequest(requestId, false)
    this.session.removedListener(this)
    this.session.commitMonitorView()
    delete liveSessionListeners[this.id]
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
  haveLiveSession: {
    config: { public: true, stream: false, upload: false },
    request: { },
    response: { properties: { 'schema': { type: 'object' }, 'mutations': { type: 'object' } } },
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      if (liveSessions[reqData.sessionId]) return { ip: process.env.IPADDRESS }
      return {}
    }
  },
  liveSession: {
    config: { public: true, stream: true, upload: false },
    request: { listenerId: { type: 'string' }, sessionId: { type: 'string' }, lastUpdate: { type: 'number' }, maxViews: { type: 'number' }, maxQueries: { type: 'number' }, keepAlive: { type: 'number' } },
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
      log('liveSession connected', { reqData })
      writeEvent('connected', { })

      // if (reqData.sessionId) {
      //   if (!liveSessions[reqData.sessionId]) {
      //     // FIND SESSION ID ON OTHER HOSTS
      //     let haveLiveSessionResponse = await netClient.rpc(this.serviceName, 'haveLiveSession', { sessionId: reqData.sessionId }, {}, false, true)
      //     log('liveSession haveLiveSessionResponse', haveLiveSessionResponse)
      //     for (let hostResponse of haveLiveSessionResponse) {
      //       if (hostResponse.ip) {
      //         writeEvent('reconnectTo', { ip: hostResponse.ip })
      //         return false
      //       }
      //     }
      //   }
      // }
      var liveSessionListener
      if (reqData.listenerId && liveSessionListeners[reqData.listenerId]) {
        liveSessionListener = liveSessionListeners[reqData.listenerId]
        await liveSessionListener.reconnect(writeEvent)
      } else {
        liveSessionListener = new LiveSessionListenerClass()
        await liveSessionListener.init(reqData.sessionId, writeEvent, allSessions)
        if (reqData.listenerId)writeEvent('resendRequests', { })
      }
      if (reqData.maxViews)liveSessionListener.session.maxViews = reqData.maxViews
      if (reqData.maxQueries)liveSessionListener.session.maxQueries = reqData.maxQueries
      if (reqData.keepAlive)liveSessionListener.keepAlive = reqData.keepAlive
      stream.on('close', async () => {
        await liveSessionListener.disconnect()
      })
    }
  },
  liveSessionCommands: {
    config: { public: false, stream: false, upload: false },
    request: { properties: { listenerId: { type: 'string' }, sessionId: { type: 'string' }, commands: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, params: { type: 'object' } }, required: [ 'command', 'params' ] } } }, required: [ 'commands' ] },
    response: { type: 'array', items: { type: 'object', properties: { success: { type: 'string' }, data: { type: 'object' } } } },
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var listenerId = reqData.listenerId
      var liveSessionListener = liveSessionListeners[listenerId]
      if (!liveSessionListener) throw new Error('listener not initialized')
      log('liveSessionListenerCommands', reqData)
      var responses = []
      for (var commandInfo of reqData.commands) {
        if (commandInfo.command === 'addRequest') {
          let data = await liveSessionListeners[listenerId].addRequest(commandInfo.params, meta)
          responses.push({ success: 'Query Request Added', data })
        }
        if (commandInfo.command === 'removeRequest') {
          let data = await liveSessionListeners[listenerId].removeRequest(commandInfo.params.requestId)
          responses.push({ success: 'Query Request Removed', data })
        }
        if (commandInfo.command === 'emitEvent') {
          mainServiceEventsBus.emit('remoteEvent', [commandInfo.params.eventName, commandInfo.params.event])
          responses.push({ success: 'mainServiceEventsBus emitted Event' })
        }
        if (commandInfo.command === 'garbageCollection') {
          await liveSessionListeners[listenerId].session.garbageCollection(commandInfo.params.maxViews, commandInfo.params.maxQueries)
          responses.push({ success: 'garbageCollection' })
        }
      }
      return responses
    }
  }
}
module.exports = serviceMethods
