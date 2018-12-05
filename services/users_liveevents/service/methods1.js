const path = require('path')
const EventEmitter = require('events')
const uuidv4 = require('uuid/v4')
const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
const EMAIL = require('sint-bit-utils/utils/email')
var CONFIG = require('./config')
// var mutationsPack = require('sint-bit-cqrs/mutations')({ mutationsPath: path.join(__dirname, '/mutations') })
const auth = require('sint-bit-utils/utils/auth')
var netClient

process.env.debugMain = true
// process.env.debugCouchbase = true
// process.env.debugJesus = true
// process.env.debugSchema = true

const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'MAIN', msg, data])) }
const debug = (msg, data) => { if (process.env.debugMain)console.log('\n' + JSON.stringify(['DEBUG', 'MAIN', msg, data])) }
const errorLog = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'MAIN', msg, data])); console.error(data) }
var itemId = (item) => uuidv4()

const objectHash = function (x) {
  log('objectHash', x)
  if (!(x instanceof Object)) return x
  var array = []
  for (var p in x) {
    array.push(p + '_' + objectHash(x[p]))
  }
  log('objectHash array', array)
  return array.sort().join('__')
}

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
//   }
//   for ( p in y ) {
//     if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) return false;
//   }
//   return true;
// }

var entitySchemaProperties = {}

var defaultResponseSchema = {
  additionalProperties: false,
  properties: {
    __RESULT_TYPE__: { type: 'string' },
    error: { type: 'string' },
    errorType: { type: 'string' },
    errorData: { type: 'object' },
    success: { type: 'string' },
    data: { type: 'object' },
    view: {additionalProperties: false, type: 'object'},
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

var getTokenData = async function (meta = {}) {
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
  var permissionsArray = tokenData.permissions || []
  var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
  log('getTokenData', {meta, userId, tokenData, permissionsArray, permissions})
  return {userId, tokenData, permissionsArray, permissions}
}

var serviceAutotest = async function (reqData, meta, getStream) {
  var errors = []
  var testId = uuidv4()

  // getUserByMail
  debug('autotest start ', testId)

  if (errors.length) {
    var testResults = {testId, error: 'test errors', data: errors}
    errorLog('autotest error ', testResults)
    return testResults
  }
  debug('autotest success ', testId)
  return {testId, success: 'all tests passed!'}
}

var serviceStarted = false
var autotestResults = false

var liveSessionListeners = {}
var liveSessions = {}

// -----------------------------------------------------------------

class MainServiceEventsBus extends require('events') {
  async init (mainServiceName, filterFunc) {
    this.filterFunc = filterFunc
    this.serviceInfo = await netClient.rpc(mainServiceName, 'serviceInfo', {})
    this.stream = await netClient.rpc(mainServiceName, 'getEvents', {type: 'mutation', filter: this.filterFunc.toString(), filterData: {}}, {}, true, true)
    this.stream.on('data', async (data) => {
      var dataType = ['command', 'event'][data.shift()]
      if (dataType === 'event') { this.emit('remoteEvent', data) }
    })
  }
  updateFilter () {
    this.filterData = {}
    this.emit('updateFilter', this.filterData)
    var patch = rfc6902.createPatch(JSON.parse(this.filterDataJsonCopy || {}), this.filterData)
    this.stream.write({command: 'filterApplyPatch', patch})
    this.filterDataJsonCopy = JSON.stringify(this.filterData)
  }
}
var filterEvents = function (filterData, eventInfo, serviceInfo) {
  console.log('filterEvents external function', filterData, eventInfo)
  var eventData = eventInfo[1]
  if (!eventData.mutation || !eventData.objId) return null
  if (eventData.mutation === 'create') return eventInfo
  if (!filterData.viewsAndFields) filterData.viewsAndFields = {}
  var viewFields = filterData.viewsAndFields[eventData.objId]
  if (viewFields) {
    log('filterEvents serviceInfo.mutations[eventData.mutation]', serviceInfo.mutations[eventData.mutation])
          // if (mutationsInfo[eventData.mutation].fieldsWrite.indexOf('*') > -1) return eventInfo
          // for (var i in viewFields) {
          //   if (mutationsInfo[eventData.mutation].fieldsWrite.indexOf(viewFields[i]) > -1) return eventInfo
          // }
  }
  return null
}
var mainServiceEventsBus = new MainServiceEventsBus('users', filterEvents)
var rfc6902 = require('rfc6902')

class LiveSessionClass {
  constructor (mainServiceEventsBus) {
    var liveSession = this
    this.id = uuidv4()
    this.filterData = {}
    this.eventsQueue = []
    this.sessionListeners = []
    this.queries = {}
    this.views = {}
    this.mainServiceEventsFilter = (remoteEvent) => { if (mainServiceEventsBus.filterFunc(this.filterData, remoteEvent, mainServiceEventsBus.serviceInfo)) liveSession.emit('sessionEvent', remoteEvent) }
    // this.mainServiceUpdateFilter = (filterData) => {
    //   liveSession.filterData = {}
    //   liveSession.filterData = {}
    // }
    mainServiceEventsBus.on('remoteEvent', this.mainServiceEventsFilter)
    liveSessions[this.id] = this
    // mainServiceEventsBus.on('updateFilter', this.mainServiceUpdateFilter)
  }
  addSessionListener (listener) {
    if (!this.sessionListeners.length) {
      this.eventsQueue.each((params) => listener.writeEvent.apply(null, params))
      this.eventsQueue = []
    }
    this.sessionListeners.push(listener)
  }
  writeEvent (eventName, event) {
    if (this.sessionListeners[0]) this.sessionListeners[0].writeEvent(eventName, event)
    else this.eventsQueue.push([eventName, event])
  }
  removeSessionListener (listener) {
    var index = this.sessionListeners.find((lis) => lis.id === listener.id)
    if (index !== undefined) this.sessionListeners.splice(index, 1)
  }
  // addView (view,fields) {
  //   if(!this.views[view.id]){
  //     thiys.views[view.id]={view,count:1}
  //     this.writeEvent ("view", view)
  //   } else this.views[view.id].count++
  // }
  // removeView (viewId) {
  //   if(this.views[viewId]){
  //     this.views[view.id].count--
  //     if(!this.views[view.id].count)delete this.views[view.id]
  //   }
  // }

  async addQuery (listenerQuery) {
    if (!this.queries[listenerQuery.hash]) {
      this.queries[listenerQuery.hash] = { listenerQuery }
      listenerQuery.queryParams.idsOnly = false
      listenerQuery.queryParams.fields.push('VIEW_META')
      let response = await netClient.rpc('users', listenerQuery.query, listenerQuery.queryParams, listenerQuery.meta)
      if (response.view) {
        this.queries[listenerQuery.hash].isSingleResult = true
        this.queries[listenerQuery.hash].viewIds = [response.view.id]
      } else if (response.results) {
        this.queries[listenerQuery.hash].isSingleResult = false
        this.queries[listenerQuery.hash].viewIds = []
        for (var result of response.results) {
          this.queries[listenerQuery.hash].viewIds.push(result.id)
        }
      }
    }
  }
  async updateQueries () {
    this.queries = {}
    for (var sessionListener of this.sessionListeners) {
      for (var listenerQuery of sessionListener.queries) {
        await this.addQuery(listenerQuery)
      }
    }
  }
  async update () {
    var filterData = {}
    for (var query of this.queries) {
      let queryFields = query.listenerQuery.queryParams.fields
      for (var viewId of query.results) {
        if (!filterData[viewId])filterData[viewId] = queryFields.slice()
        else if (filterData[viewId])queryFields.forEach((field) => { if (filterData[viewId].indexOf(field) < 0) filterData[viewId].push(field) })
      }
    }
    this.mainServiceEventsBus.update()
  }
  end () {

  }
}

class LiveSessionListenerClass {
  constructor (sessionId, writeEvent, mainServiceEventsBus) {
    this.id = uuidv4()
    this.canReceiveEvents = true
    this.writeEvent = writeEvent
    this.queries = []
    if (sessionId) {
      if (liveSessions[sessionId]) this.session = liveSessions[sessionId]
      else throw new Error('session not initialized')
    } else this.session = new LiveSessionClass(mainServiceEventsBus)
    liveSessionListeners[this.id] = this
    this.session.addListener(this)
  }
  async addQuery (params, meta) {
    var id = uuidv4()
    var hash = objectHash(params)
    var query = { id, params, hash, meta }
    this.queries.push(query)
    return id
  }
  removeQuery (id) {
    var index = this.queries.find((query) => query.id === id)
    if (index !== undefined) this.queries.splice(index, 1)
  }
  async update () {
    await this.session.update()
  }
  end () {
    this.session.removeListener(this)
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
    config: {public: false, stream: false, upload: false},
    exec: serviceAutotest
  },
  status: {
    config: {public: false, stream: false, upload: false},
    exec: async function (reqData, meta, getStream) {
      var result = {data: {serviceStarted, autotestResults}}
      if (serviceStarted && autotestResults.success) {
        result.success = 'service status ok'
      } else {
        result.error = 'service can have some problems'
      }
      return result
    }
  },
  serviceInfo: {
    config: {public: true, stream: false, upload: false},
    request: {},
    response: {properties: {'schema': {type: 'object'}, 'mutations': {type: 'object'}}},
    exec: async function (reqData, meta = {directCall: true, is_test: false}, getStream = null) {
      log('serviceMethods', serviceMethods)
      var schemaOut = {}
      for (var i in serviceMethods) if (serviceMethods[i].config && serviceMethods[i].config.public) schemaOut[i] = serviceMethods[i].request
      return {schema: schemaOut}
    }
  },
  liveSession: {
    config: {public: true, stream: true, upload: false},
    request: {lastUpdate: {type: 'number'}},
    response: {},
    exec: async function (reqData, meta = {directCall: true, is_test: false}, getStream = null) {
      /*
      dividere in cache session e live session
      cache session per tenere traccia dei timestamp dei dati presenti nella cache front end (salvata sul db)
        -in alternativa si potrebbe usare un unico timestamp es cacheSessionLastUpdate ed evitare il salvataggio nel db?
      live session per tenere traccia delle richieste registrate dal server
      dovrebbe poter gestire più richieste parallele della stessa cache session (1 computer, molte finestre)
    */
      var writeEvent = (eventName, data) => stream.write('event: ' + eventName + '\ndata: ' + JSON.stringify(data) + '\n\n')

      var stream = getStream()
      log('liveSessionListener connected', {})
      writeEvent('connected', {})

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
        liveSessionListener = new LiveSessionListenerClass(meta.sessionid, writeEvent)
      }

      stream.on('end', () => {
        liveSessionListener.canReceiveEvents = false
        setTimeout(() => liveSessionListener.end(), 60000)
      })
    }
  },
  liveSessionCommands: {
    config: {public: false, stream: false, upload: false},
    request: { properties: {commands: {type: 'array', items: {type: 'object', properties: {command: {type: 'string'}, params: {type: 'object'}}, required: [ 'command', 'params' ]}}}, required: [ 'commands' ] },
    response: {},
    exec: async function (reqData, meta = {directCall: true, is_test: false}, getStream = null) {
      var listenerId = meta.listenerid
      var liveSessionListener = liveSessionListeners[listenerId]
      if (!liveSessionListener) throw new Error('listener not initialized')
      log('liveSessionListenerCommands', reqData)
      for (var commandInfo of reqData.commands) {
        if (commandInfo.command === 'addQuery') {
          await liveSessionListeners[listenerId].addQuery(commandInfo.params, meta)
        }
      }
      return {success: 'liveSessionCommands accepted'}
    }
  }
}
module.exports = serviceMethods
