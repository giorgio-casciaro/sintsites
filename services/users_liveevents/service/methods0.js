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

var entitySchemaProperties = {
  id: {
    type: 'string',
    description: 'id in format UUID v4',
    pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
  },
  name: { type: 'string' },
  firstName: { type: 'string' },
  lastName: { type: 'string' },
  birth: { type: 'string' },
  publicName: { type: 'string' },
  public: { type: 'boolean' },
  email: { description: 'valid email', type: 'string', 'format': 'email' },
  tags: {
    type: 'array',
    'default': [],
    items: {
      type: 'string', 'minLength': 3, 'maxLength': 50
    }
  },
  password: {
    description: 'Minimum 6 characters at least 1 Uppercase Alphabet, 1 Lowercase Alphabet and 1 Number',
    type: 'string',
    pattern: '^[a-zA-Z0-9_#?!@$%^&*-]{6,30}$'
  },
  confirmPassword: {
    type: 'string'
  },
  pics: {
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: { sizes: { type: 'object' }, picId: { type: 'string' } },
      required: ['picId', 'sizes']
    }
  },
  deleted: { type: 'boolean' },
  VIEW_META: {
    updated: { type: 'number' },
    created: { type: 'number' },
    is_test: { type: 'boolean' }
  },
  options: { type: 'object' },
  notifications: { type: 'object' },
  emailConfirmationCode: {
    type: 'string',
    description: 'emailConfirmationCode in format UUID v4',
    pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
  }
}

var defaultResponseSchema = {
  additionalProperties: false,
  properties: {
    __RESULT_TYPE__: { type: 'string' },
    error: { type: 'string' },
    errorType: { type: 'string' },
    errorData: { type: 'object' },
    success: { type: 'string' },
    data: { type: 'object' },
    view: {additionalProperties: false, type: 'object', properties: entitySchemaProperties},
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

class MicroserviceEventEmitter extends require('events') {}
var UsersEventsBus
var rfc6902 = require('rfc6902')
const startUsersEventsBus = async() => {
  UsersEventsBus = new MicroserviceEventEmitter()
  UsersEventsBus.filterData = {}
  UsersEventsBus.listeners = []
  UsersEventsBus.filterDataJsonCopy = JSON.stringify(UsersEventsBus.filterData)
  UsersEventsBus.addListener = (listener) => {
    UsersEventsBus.listeners.push(listener)
    UsersEventsBus.updateFilter()
  } // {filterData:{},exec:func()}
  UsersEventsBus.removeListener = (listener) => { if (UsersEventsBus.listeners.indexOf(listener) > -1)UsersEventsBus.listeners.splice(UsersEventsBus.listeners.indexOf(listener), 1) }
  var getServiceInfoLastUpdate = 0
  UsersEventsBus.getServiceInfo = async() => {
    if (Date.now() - getServiceInfoLastUpdate > 60000) {
      UsersEventsBus.serviceInfo = await netClient.rpc('users', 'serviceInfo', {})
      getServiceInfoLastUpdate = Date.now()
    }
    return UsersEventsBus.serviceInfo
  }
  UsersEventsBus.updateFilter = () => {
    UsersEventsBus.filterData = {
      viewsAndFields: {}
    }
    for (var i in UsersEventsBus.listeners) {
      var listener = UsersEventsBus.listeners[i]
      for (var viewId in listener.filterData.viewsAndFields) {
        var fields = listener.filterData.viewsAndFields[viewId]
        var busFields = UsersEventsBus.filterData.viewsAndFields[viewId]
        if (busFields) fields.forEach((field) => { if (busFields.indexOf(field) === -1)busFields.push(field) })
        else UsersEventsBus.filterData.viewsAndFields[viewId] = fields
      }
    }
    var patch = rfc6902.createPatch(JSON.parse(UsersEventsBus.filterDataJsonCopy), UsersEventsBus.filterData)
    UsersEventsBus.stream.write({command: 'filterApplyPatch', patch})
    UsersEventsBus.filterDataJsonCopy = JSON.stringify(UsersEventsBus.filterData)
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
  UsersEventsBus.stream = await netClient.rpc('users', 'getEvents', {type: 'mutation', filter: filterEvents.toString(), filterData: UsersEventsBus.filterData}, {is_test: true}, true, true)
  UsersEventsBus.stream.on('data', async (data) => {
    var dataType = ['command', 'event'][data.shift()]
    log('UsersEventsBus stream data', {data, dataType})
    var serviceInfo = await UsersEventsBus.getServiceInfo()
    for (var i in UsersEventsBus.listeners) {
      var listener = UsersEventsBus.listeners[i]
      var sendEvent = filterEvents(listener.filterData, data, serviceInfo)
      log('UsersEventsBus stream listener sendEvent', sendEvent)
      if (sendEvent !== null)listener.exec(sendEvent)
    }
  })
}
class liveSessionClass {
  constructor () {
    var liveSession = this
    this.queriesStatus = {}
    this.notSendedEventsQueue = []
    this.viewsFieldsStatus = {}
    this.listeners = []
    this.UsersEventsBusListener = {
      filterData: {},
      exec: (data) => {
        log('liveSessionClass UsersEventsBusListener exec', {data})
        liveSession.writeEvent(data[0], data[1])
      }
    }
    UsersEventsBus.addListener(this.UsersEventsBusListener)
  }
  writeEvent (eventName, data) {
    var listener = this.listeners.find((listener) => listener.canReceiveEvents)
    if (listener)listener.writeEvent(eventName, data)
  }
  addListener (listener) {
    listener.liveSession = this
    this.listeners.push(listener)
  }
  removeListener (listener) {
    this.listeners.splice(this.listeners.indexOf(listener), 1)
  }
  getViewsFieldsLastUpdate (viewIds, fields) {
    var liveSession = this
    return viewIds.reduce((lastUpdate, id) => {
      var fieldsLastUpdate = fields.reduce((lastFieldUpdate, field) => {
        if (liveSession.viewsFieldsStatus[id][field] > lastFieldUpdate) return liveSession.viewsFieldsStatus[id][field]
        return lastFieldUpdate
      }, 0)
      if (fieldsLastUpdate > lastUpdate) return fieldsLastUpdate
      return lastUpdate
    }, 0)
  }
  // addQuery (id, results, fields) {
  //   var query = {results, id, fields, lastUpdate: this.getViewsFieldsLastUpdate(results, fields)}
  //   log('liveSessionClass addQuery ', query)
  //   this.writeEvent('query', results)
  //   // if (this.queriesStatus[id] && this.queriesStatus[id].lastUpdate) { this.queriesStatus[id] } else {}
  //   // queryStatus.results = idsOnly
  //   // queryStatus.lastUpdate = Date.now()
  //   // send front end if different
  // }
  async addQuery (newQueryId, newQuery) {
    // if (this.queriesStatus[newQueryId])newQuery.queryParams.loadIfUpdatedAfter = this.queriesStatus[newQueryId].lastUpdate
    if (!this.queriesStatus[newQueryId]) {
      log('liveSessionClass addQuery params', {newQuery})
      newQuery.queryParams.fields.push('VIEW_META')
      var response = await netClient.rpc('users', newQuery.query, newQuery.queryParams)
      log('liveSessionClass addQuery response', {response})
      var results
      if (response.view) results = [response.view]
      else results = response.results
      log('liveSessionClass addQuery results', {results})
      var queryIdsOnly = []
      for (var result of results) {
        if (result instanceof Object) {
          this.addView(result)
          queryIdsOnly.push(result.id)
        } else queryIdsOnly.push(result)
      }
      this.writeEvent('query', {id: newQueryId, results: queryIdsOnly})
    }
    // this.addViewsFieldsToMonitor(queryIdsOnly, newQuery.queryParams.fields)
    log('liveSessionClass addQuery', { newQuery })
    // this.addQuery(newQueryId, queryIdsOnly, newQuery.queryParams.fields)
    // log('liveSessionClass addQuery addQueryToMonitor', { queryIdsOnly })
    // var query = {results, id, fields, lastUpdate: this.getViewsFieldsLastUpdate(results, fields)}
    // log('liveSessionClass addQuery ', query)
  }
  addView (view) {
    log('liveSessionClass addView ', view)
    if (!this.viewsFieldsStatus[view.id]) this.viewsFieldsStatus[view.id] = view.VIEW_META.FU_META
    else { for (var i in view.VIEW_META.FU_META) this.viewsFieldsStatus[view.id][i] = view.VIEW_META.FU_META[i] }
    delete view.VIEW_META
    this.writeEvent('view', view)
  }
}
class liveSessionListenerClass {
  constructor () {
    this.canReceiveEvents = true
    this.queriesToMonitor = {}
    // this.viewsFieldsStatusToMonitor = {}
    // this.viewsFieldsToMonitor = {}
  }
  async addViewsFieldsToMonitor (viewIds, fields) {
    for (var viewId of viewIds) {
      this.viewsFieldsToMonitor[viewId] = fields
    }
  }
  async addQueryToMonitor (newQuery) {
    var newQueryId = objectHash(newQuery)
    log('addQueryToMonitor newQueryId', {newQuery, newQueryId})
    if (!this.queriesToMonitor[newQueryId]) {
      this.queriesToMonitor[newQueryId] = newQuery
      this.liveSession.addQuery(newQueryId, newQuery)
      // newQuery.id = newQueryId
      // if (this.liveSession.queriesStatus[newQueryId])newQuery.queryParams.loadIfUpdatedAfter = this.liveSession.queriesStatus[newQueryId].lastUpdate
      // log('addQueryToMonitor params', {newQuery})
      // newQuery.queryParams.fields.push('VIEW_META')
      // var response = await netClient.rpc('users', newQuery.query, newQuery.queryParams)
      // log('addQueryToMonitor response', {response})
      // if (response.view) var results = [response.view]
      // else var results = response.results
      // log('addQueryToMonitor results', {results})
      // // writeEvent('query', results)
      // var queryIdsOnly = []
      // for (var result of results) {
      //   if (result instanceof Object) {
      //     this.liveSession.addView(result)
      //     queryIdsOnly.push(result.id)
      //   } else queryIdsOnly.push(result)
      // }
      // this.addViewsFieldsToMonitor(queryIdsOnly, newQuery.queryParams.fields)
      // this.liveSession.addQuery(newQueryId, queryIdsOnly, newQuery.queryParams.fields)
      // log('addQueryToMonitor addQueryToMonitor', { queryIdsOnly})
    }
  }
}
var serviceMethods = {
  init: async function (setNetClient) {
    netClient = setNetClient

    var sharedMethods = require('sint-bit-utils/utils/sharedMethods')
    await sharedMethods.init(netClient, serviceMethods)
    for (var i in sharedMethods)serviceMethods[i] = sharedMethods[i]

    await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
    // await DB.createIndex('views', ['dashId', 'userId'])
    // await DB.createIndex(['email'])
    // await DB.createIndex(['guest'])
    // await DB.createIndex(['VIEW_META.updated'])
    // await DB.createIndex(['DOC_TYPE'])
    // usersEventsBus = await netClient.listen([{serviceName: 'users', method: 'getEvents', params: {type: 'mutation', filter: 'byViewIdAndMutationType', filterData: {mutationTypes: ['create']}}}])
    await startUsersEventsBus()
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
      var mutations = {}
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

      log('liveSessionListener meta', meta)
      if (!meta.sessionid) {
        meta.sessionid = uuidv4()
        writeEvent('sessionId', meta.sessionid)
      }
      if (!meta.listenerid) {
        meta.listenerid = uuidv4()
        writeEvent('listenerId', meta.listenerid)
      }

      var sessionId = meta.sessionid
      var listenerId = meta.listenerid
      if (!liveSessions[sessionId]) liveSessions[sessionId] = new liveSessionClass()
      var liveSession = liveSessions[sessionId]
      if (!liveSessionListeners[listenerId]) liveSessionListeners[listenerId] = new liveSessionListenerClass()
      var liveSessionListener = liveSessionListeners[listenerId]
      liveSessionListener.canReceiveEvents = true
      liveSessionListener.writeEvent = writeEvent
      liveSession.addListener(liveSessionListener)
      stream.on('end', () => {
        liveSessionListener.canReceiveEvents = false
        setTimeout(() => {
          liveSession.removeListener(liveSessionListener)
          delete liveSessionListener[listenerId]
        }, 60000)
      })
    }
  },
  liveSessionCommands: {
    config: {public: false, stream: false, upload: false},
    request: { properties: {commands: {type: 'array', items: {type: 'object', properties: {command: {type: 'string'}, params: {type: 'object'}}, required: [ 'command', 'params' ]}}}, required: [ 'commands' ] },
    response: {},
    exec: async function (reqData, meta = {directCall: true, is_test: false}, getStream = null) {
      if (!meta.listenerid) {
        throw new Error('no listenerid meta/cookie')
      }
      var listenerId = meta.listenerid
      var liveSessionListener = liveSessionListeners[listenerId]
      if (!liveSessionListener) throw new Error('listener not initialized')
      log('liveSessionListenerCommands', reqData)
      for (var commandInfo of reqData.commands) {
        if (commandInfo.command === 'addQuery') {
          await liveSessionListeners[listenerId].addQueryToMonitor(commandInfo.params)
        }
      }
      return {success: 'liveSessionCommands accepted'}
    }
  }
}
module.exports = serviceMethods
