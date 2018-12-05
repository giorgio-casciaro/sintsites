const path = require('path')
const EventEmitter = require('events')
const uuidv4 = require('uuid/v4')
const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
const EMAIL = require('sint-bit-utils/utils/email')

var CONFIG = require('./config')
// var mutationsPack = require('sint-bit-cqrs/mutations')({  mutationsPath: path.join(__dirname, '/mutations')  })
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

const LiveSessionsClass = require('sint-bit-utils/utils/sessions').LiveSessionsClass
const MainServiceEventsBus = require('sint-bit-utils/utils/sessions').MainServiceEventsBus
const LiveSessionListenerClass = require('sint-bit-utils/utils/sessions').LiveSessionListenerClass

// -----------------------------------------------------------------
var mainServiceEventsBus
var allSessions
var serviceMethods = {
  init: async function (setNetClient) {
    netClient = setNetClient

    var sharedMethods = require('sint-bit-utils/utils/sharedMethods')
    await sharedMethods.init(netClient, serviceMethods)
    for (var i in sharedMethods)serviceMethods[i] = sharedMethods[i]

    await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)

    autotestResults = await serviceAutotest()
    setInterval(async arg => { autotestResults = await serviceAutotest() }, 60000)
    serviceStarted = true

    mainServiceEventsBus = new MainServiceEventsBus('users', filterEvents, netClient)
    allSessions = new LiveSessionsClass(mainServiceEventsBus, filterEvents, netClient)
    await mainServiceEventsBus.init()

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
      if (allSessions.sessions[reqData.sessionId]) return { ip: process.env.IPADDRESS }
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
      //   if (!allSessions.sessions[reqData.sessionId]) {
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
      if (reqData.listenerId && allSessions.listeners[reqData.listenerId]) {
        liveSessionListener = allSessions.listeners[reqData.listenerId]
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
      var liveSessionListener = allSessions.listeners[listenerId]
      if (!liveSessionListener) throw new Error('listener not initialized')
      log('liveSessionListenerCommands', reqData)
      var responses = []
      for (var commandInfo of reqData.commands) {
        if (commandInfo.command === 'addRequest') {
          var tokenData = await getTokenData(meta)
          var queryIdHashExtraParams = [tokenData.userId, tokenData.permissions]
          let data = await allSessions.listeners[listenerId].addRequest(commandInfo.params, meta, queryIdHashExtraParams)
          responses.push({ success: 'Query Request Added', data })
        }
        if (commandInfo.command === 'removeRequest') {
          let data = await allSessions.listeners[listenerId].removeRequest(commandInfo.params.requestId)
          responses.push({ success: 'Query Request Removed', data })
        }
        if (commandInfo.command === 'emitEvent') {
          mainServiceEventsBus.emit('remoteEvent', [commandInfo.params.eventName, commandInfo.params.event])
          responses.push({ success: 'mainServiceEventsBus emitted Event' })
        }
        if (commandInfo.command === 'garbageCollection') {
          await allSessions.listeners[listenerId].session.garbageCollection(commandInfo.params.maxViews, commandInfo.params.maxQueries)
          responses.push({ success: 'garbageCollection' })
        }
      }
      return responses
    }
  }
}
module.exports = serviceMethods
