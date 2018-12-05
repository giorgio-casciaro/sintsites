process.on('unhandledRejection', (err, p) => {
  console.error(err)
  console.log('An unhandledRejection occurred')
  console.log(`Rejected Promise: ${p}`)
  console.log(`Rejection: ${err}`)
})
const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'TEST', msg, data])) }
const warn = (msg, data) => { console.log('\n' + JSON.stringify(['WARN', 'TEST', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'TEST', msg, data])) }

process.env.debugMain = true
process.env.couchbaseExtraProps = {
  IS_TEST: true
}
// process.env.debugCouchbase = true
// process.env.debugJesus = true
// process.env.debugSchema = true

var startTest = async function (netClient) {
  var apiCall = async (method, data, meta, asStream, returnRaw) => {
    // log('apiCall', { method, data, meta })
    meta.is_test = true
    var headers = { }
    for (var i in meta)headers['app-meta-' + i] = meta[i]
    // log('apiCall headers', { meta, headers })
    headers['Content-Type'] = 'multipart/form-data'
    var request = require('request-promise-native')
    try {
      log('apiCall', { method, data, headers })
      var raw = await request.post({ url: 'http://127.0.0.1/' + method, formData: data, headers })
      if (returnRaw) return raw
      var response = JSON.parse(raw)

      return response
    } catch (err) {
      return err
    }
  }
  var apiCallInternal = async (method, data, meta, asStream) => {
    // rpc: async (serviceName, methodName, data, meta, asStream, toEveryTask = false, addedStream = false, removedStream = false) => {
    meta.is_test = true
    var response = await netClient.rpc('civil-microservices_users', method, data, meta, asStream, false, false, false, '127.0.0.1')
    // log('apiCallInternal response', { response })
    return response
  }

  await new Promise((resolve) => setTimeout(resolve, 5000))
  var CONFIG = require('../config')
  const auth = require('sint-bit-utils/utils/auth')
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 1)
  mainTest.consoleResume()
  // function getPuppetSubscriptionsGetPermissions (substitutions = {  }) {
  //   var defaultSubscription = Object.assign({
  //     id: 'testSubscription',
  //     permissions: ['usersWrite', 'usersRead', 'usersConfirm', 'usersWriteOtherUsers', 'usersReadAll'],
  //     dashId: 'testDash',
  //     userId: '11111111-1111-1111-1111-111111111111'
  //    }, substitutions)
  //   // mainTest.log('getPuppetSubscriptionsGetPermissions', { substitutions, defaultSubscription })
  //   var func = function ({ data }) {  return {  results: [defaultSubscription]  }  }
  //   return func
  //  }
  async function createEntity (entity) {
    var obj = Object.assign({ id: 'testDash_11111111-1111-1111-1111-111111111111', VIEW_META: { created: Date.now(), updated: Date.now(), is_test: true } }, entity)
    obj.VIEW_META.FU_META = {
      'id': 1535176491257,
      'email': 1535176491257,
      'emailConfirmationCode': 1535176491257,
      'emailConfirmed': 1535176491257,
      'logins': 1535176491257,
      'logouts': 1535176491257,
      'meta': 1535176491257,
      'password': 1535176491257,
      'permissions': 1535176491257,
      'personalInfo': 1535176491257,
      'pics': 1535176491257,
      'publicName': 1535176491257,
      'DOC_TYPE': 1535176491257,
      'META': 1535176491257,
      'tags': 1535176491257
    }
    await DB.remove(obj.id)
    await DB.put('view', obj)
  }
  async function setContext (contextData) {
    var i
    var tokens = { }
    for (i in contextData.users)tokens[i] = await auth.createToken(i, contextData.users[i], CONFIG.jwt)
    for (i in contextData.entities) createEntity(contextData.entities[i])

    Object.assign(netClient.testPuppets, contextData.testPuppets || { })
    return {
      tokens,
      data: contextData.data,
      updateData: (substitutions) => {
        var value
        for (var k in substitutions) {
          value = contextData.data
          k.split('/').forEach(addr => (value = value[addr]))
          value = substitutions[k]
        }
      },
      updatePuppets: (testPuppets) => Object.assign(netClient.testPuppets, testPuppets || { }),
      destroy: async () => {
        for (i in contextData.entities) await DB.remove(contextData.entities[i].id)
      }
    }
  }

  const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
  await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
  const dbGet = (id = '11111111-1111-1111-1111-111111111111') => DB.get(id)
  const dbRemove = (id = '11111111-1111-1111-1111-111111111111') => DB.remove(id)
  var context

  var microRandom = Math.floor(Math.random() * 100000)
  var testEmail = `test${microRandom}@test.com`

  // mainTest.sectionHead('STREAM DUPLEX')
  // mainTest.consoleResume()
  // context = await setContext({  data: {   }, users: {  '11111111-1111-1111-1111-111111111111': { permissions: ['dashboardsCreate'] }  }, entities: []  })
  // var stream = await apiCallInternal('getEvents', { type: 'mutation', filter: 'byViewIdAndMutationField', filterData: { mutationFields: ['create'] } }, { is_test: true }, true)
  // stream.on('readable', () => {
  //   var chunk
  //   while ((chunk = stream.read()) !== null) {
  //     log('getEvents stream readable', chunk)
  //     // stream.write({ log: 'getEvents stream readable', chunk })
  //    }
  //  })
  // await new Promise((resolve) => setTimeout(resolve, 5000))
  // stream.write({ command: 'filterByViewIdAndMutationField_Add', viewIds: ['11111111-1111-1111-1111-111111111111'] })
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // for (var i = 0; i < 2; i++) await apiCallInternal('emitEvent', { type: 'mutation', data: { 'objId': '11111111-1111-1111-1111-111111111111', mutation: 'create' } }, { is_test: true, token: context.tokens['11111111-1111-1111-1111-111111111111'] }, true)
  // await new Promise((resolve) => setTimeout(resolve, 5000))
  // stream.write({ command: 'filterByViewIdAndMutationField_Remove', viewIds: ['11111111-1111-1111-1111-111111111111'] })
  // await new Promise((resolve) => setTimeout(resolve, 10000))
  // await stream.destroy()
  // await context.destroy()

  // mainTest.sectionHead('STREAM DUPLEX MULTIHOST')
  // mainTest.consoleResume()
  // context = await setContext({  data: {   }, users: {  '11111111-1111-1111-1111-111111111111': { permissions: ['dashboardsCreate'] }  }, entities: []  })
  // var filterEvents = function (filterData, eventInfo, serviceInfo) {
  //   console.log('filterEvents external function', { filterData, eventInfo, serviceInfo })
  //   if (filterData.passAll) return eventInfo
  //  }
  // var requestFilter = { passAll: false }
  // var stream = await apiCallInternal('getEvents', { type: 'mutation', filter: filterEvents.toString(), filterData: requestFilter }, { is_test: true }, true, true)
  // stream.on('data', (data) => {
  //   console.log('getEvents stream data', data)
  //  })
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // for (var i = 0; i < 1; i++) await apiCallInternal('emitEvent', { type: 'mutation', data: { 'objId': '11111111-1111-1111-1111-111111111111', mutation: 'create' } }, { is_test: true, token: context.tokens['11111111-1111-1111-1111-111111111111'] }, true)
  //
  // var rfc6902 = require('rfc6902')
  // var requestFilterJsonCopy = JSON.stringify(requestFilter)
  // requestFilter.passAll = true
  // var patch = rfc6902.createPatch(JSON.parse(requestFilterJsonCopy), requestFilter)
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // stream.write({ command: 'filterApplyPatch', patch })
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // for (var i = 0; i < 1; i++) await apiCallInternal('emitEvent', { type: 'mutation', data: { 'objId': '11111111-1111-1111-1111-111111111111', mutation: 'addTags' } }, { is_test: true, token: context.tokens['11111111-1111-1111-1111-111111111111'] }, true)
  //
  // var requestFilterJsonCopy = JSON.stringify(requestFilter)
  // requestFilter.passAll = false
  // var patch = rfc6902.createPatch(JSON.parse(requestFilterJsonCopy), requestFilter)
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // stream.write({ command: 'filterApplyPatch', patch })
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // for (var i = 0; i < 1; i++) await apiCallInternal('emitEvent', { type: 'mutation', data: { 'objId': '11111111-1111-1111-1111-111111111111', mutation: 'addTags' } }, { is_test: true, token: context.tokens['11111111-1111-1111-1111-111111111111'] }, true)
  //
  // await new Promise((resolve) => setTimeout(resolve, 10000))
  // await stream.destroy()
  // await context.destroy()

  // mainTest.sectionHead('LIVE netClient.listen')
  // mainTest.consoleResume()
  // context = await setContext({  data: {   }, users: {  '11111111-1111-1111-1111-111111111111': { permissions: ['dashboardsCreate'] }  }, entities: []  })
  // var streamEvents = 0
  // var usersEventsBus = await netClient.listen({ serviceName: 'users', method: 'getEvents', params: { type: 'mutation', filter: 'byViewIdAndMutationField', filterData: { mutationFields: ['name'] } } })
  // usersEventsBus.on('addedStream', (stream) => {
  //   console.log('LIVE netClient.listen addedStream', stream.info)
  //  })
  // usersEventsBus.on('removedStream', (stream) => {
  //   console.log('LIVE netClient.listen removedStream', stream.info)
  //  })
  // usersEventsBus.on('streamEvent', (streamEvent) => {
  //   streamEvents++
  //   console.log('LIVE netClient.listen streamEvent', streamEvent)
  //  })
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // for (var i = 0; i < 10; i++) await apiCallInternal('emitEvent', { type: 'mutation', data: { 'objId': '11111111-1111-1111-1111-111111111111', mutation: 'create' } }, { is_test: true, token: context.tokens['11111111-1111-1111-1111-111111111111'] }, true)
  // await new Promise((resolve) => setTimeout(resolve, 5000))
  //
  // mainTest.testRaw('LIVE  netClient.listen', { streamEvents }, (data) => data.streamEvents > 9)
  //
  // await context.destroy()

  mainTest.sectionHead('LIVE SESSION')
  mainTest.consoleResume()

  context = await setContext({
    data: { },
    users: { '11111111-1111-1111-1111-111111111111': { }, userAdminTest: { permissions: ['usersWrite', 'usersReadAll', 'usersList'] } },
    entities: [{ 'id': '11111111-1111-1111-1111-111111111111', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'meta': { is_test: true, 'created': 1516090275074, 'updated': 1516090275232 }, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': { }, 'pics': { }, 'publicName': 'test23644' }]
    // testPuppets: {  subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions()  }
  })
  var sessionId
  var listenerId
  // var cacheId = 'cacheIdTest'
  // var eventSourceInitOptions = { headers: { 'Cookie': 'app-meta-token=' + context.tokens['11111111-1111-1111-1111-111111111111'] + '; app-meta-session=' + sessionId + '; app-meta-cache=' + cacheId } }
  var serviceInfo = await netClient.rpc('users', 'serviceInfo', { })

  var EventSource = require('eventsource')
  var sessionResults = { requests: [], resendRequestsCount: 0, viewsEventsCount: 0, views: { }, mutations: [], queries: { }, queriesEventsCount: 0, errors: [] }
  var getEvents = function () {
    var eventSourceInitOptions = { headers: { 'Cookie': 'app-meta-token=' + context.tokens['11111111-1111-1111-1111-111111111111'] } }
    var es = new EventSource('http://127.0.0.1/liveSession?' + (sessionId ? 'sessionId=' + sessionId + '&' : '') + (listenerId ? 'listenerId=' + listenerId + '&' : '') + 'maxViews=50&maxQueries=3&keepAlive=5', eventSourceInitOptions)
    es.addEventListener('view', function (e) {
      console.log('view', e)
      sessionResults.viewsEventsCount++
      var data = JSON.parse(e.data)
      sessionResults.views[data.id] = data
    })
    es.addEventListener('sessionId', function (e) {
      sessionId = JSON.parse(e.data)
      console.log('sessionId', e)
    // sessionResults.view.push(e.data)
    })
    es.addEventListener('listenerId', function (e) {
      listenerId = JSON.parse(e.data)
      console.log('listenerId', listenerId)
    // sessionResults.view.push(e.data)
    })
    es.addEventListener('resendRequests', async function (e) {
      mainTest.log('resendRequests', sessionResults.requests)
      sessionResults.resendRequestsCount++
      for (let request of sessionResults.requests) {
        let sendRequestResponse = await apiCallInternal('liveSessionCommands', { commands: [{ command: 'addRequest', params: { query: request.query, queryParams: request.queryParams } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
        mainTest.log('resendRequests sendRequest', sendRequestResponse)
      }
    })
    es.sendRequest = async function (query, queryParams) {
      let sendRequestResponse = await apiCallInternal('liveSessionCommands', { commands: [{ command: 'addRequest', params: { query, queryParams } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })

      mainTest.log('sendRequest', sendRequestResponse)
      var requestInfo = { query, queryParams, sendRequestResponse }
      sessionResults.requests.push(requestInfo)
      return sendRequestResponse
    }
    es.addEventListener('partial_view', function (e) {
      console.log('partial_view', e)
      let data = JSON.parse(e.data)
      if (!sessionResults.views[data.id])sessionResults.views[data.id] = {}
      Object.assign(sessionResults.views[data.id], data)
      sessionResults.viewsEventsCount++
    // sessionResults.partial_view.push(e.data)
    })
    es.addEventListener('viewRemoved', function (e) {
      console.log('viewRemoved', e)
      sessionResults.viewsEventsCount++
      var data = JSON.parse(e.data)
      delete sessionResults.views[data.id]
    })
    es.addEventListener('error', function (e) {
      console.log('error', e)
      let data = JSON.parse(e.data)
      sessionResults.errors.push(data)
    // sessionResults.partial_view.push(e.data)
    })
    es.addEventListener('mutation', function (e) {
      console.log('mutation', e)
      let data = JSON.parse(e.data)
      var mutationFile = data.mutation + '.' + data.version + '.js'
      var mutationInfo = serviceInfo.mutations[mutationFile]
      console.log('serviceInfo mutationInfo', mutationInfo)
      if (!mutationInfo.execFunc) {
        var vm = require('vm')
        const sandbox = { func: false }
        vm.createContext(sandbox)
        vm.runInContext('func = ' + mutationInfo.exec, sandbox)
        mutationInfo.execFunc = sandbox.func
      }
      if (sessionResults.views[data.objId])sessionResults.views[data.objId] = mutationInfo.execFunc(sessionResults.views[data.objId], data.data)
      sessionResults.mutations.push(data)
    // sessionResults.mutation.push(e.data)
    })
    es.addEventListener('query', function (e) {
      console.log('query', e)
      sessionResults.queriesEventsCount++
      var data = JSON.parse(e.data)
      sessionResults.queries[data.id] = data.viewIds
    })
    es.addEventListener('queryRemoved', function (e) {
      console.log('queryRemoved', e)
      sessionResults.queriesEventsCount++
      var data = JSON.parse(e.data)
      delete sessionResults.queries[data.id]
    })
    es.addEventListener('connected', function (e) {
      console.log('connected', e)
    })

    return es
  }
  var es = getEvents()
  console.log('AWAITING listenerId')
  await new Promise((resolve) => {
    es.addEventListener('listenerId', function (e) {
      console.log('listenerId', e)
      resolve()
    })
  })

  // LETTURA
  // ogni query dovrebbe generare il query id lato client
  var liveSessionCommandResponse
  // liveSessionCommandResponse = await apiCallInternal('liveSessionCommands', { commands: [{ command: 'addRequest', params: { query: 'read', queryParams: { 'id': '11111111-1111-1111-1111-111111111111', fields: ['publicName'] } } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  await es.sendRequest('read', { 'id': '11111111-1111-1111-1111-111111111111', fields: ['publicName'] })
  mainTest.log('liveSessionCommandResponse', liveSessionCommandResponse)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await apiCallInternal('liveSessionCommands', { commands: [{ command: 'addRequest', params: { query: 'read', queryParams: { 'id': '11111111-1111-1111-1111-111111111111', fields: ['publicName'] } } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await apiCallInternal('liveSessionCommands', { commands: [{ command: 'addRequest', params: { query: 'read', queryParams: { 'id': '11111111-1111-1111-1111-111111111111', fields: ['publicName'] } } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  await new Promise((resolve) => setTimeout(resolve, 4000))
  console.log('sessionResults', sessionResults)
  mainTest.testRaw('LIVE SESSION LIVE QUERY READ', sessionResults, (data) => data.viewsEventsCount === 1 && data.views['11111111-1111-1111-1111-111111111111'].publicName === 'test23644')

  // mainTest.consoleResume()
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var lastUpdatedResponse = await apiCallInternal('liveSessionCommands', { commands: [{ command: 'addRequest', params: { query: 'lastUpdated', queryParams: { fields: ['publicName'] } } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  var queryListId = lastUpdatedResponse[0].data.queryId
  log('lastUpdatedResponse', lastUpdatedResponse)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  mainTest.testRaw('LIVE SESSION LIVE QUERY LIST', sessionResults, (data) => data.queriesEventsCount === 2 && data.queries[queryListId])
  //
  // mainTest.consoleResume()
  // var event = { objId: '11111111-1111-1111-1111-111111111111', id: '11111111-1111-1111-1111-111111111111', mutation: 'updatePersonalInfo', meta: {}, version: '000', timestamp: new Date().getTime(), data: { firstName: 'updatedName', lastName: 'updatedName', birth: 'updatedName', publicName: 'updatedName' } }
  // await apiCallInternal('liveSessionCommands', { commands: [{ command: 'emitEvent', params: { eventName: 'mutation', event } }] , sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  var updatePersonalInfo = await netClient.rpc('users', 'updatePersonalInfo', { id: '11111111-1111-1111-1111-111111111111', publicName: 'NewPublicName', firstName: 'firstName', sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  log('updatePersonalInfo', updatePersonalInfo)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  mainTest.testRaw('LIVE SESSION MUTATION', sessionResults, (data) => data.mutations.length === 1)

  // mainTest.consoleResume()
  var createUserData = { email: `test${Math.floor(Math.random() * 100000)}@test.com`, tags: ['testTag'], password: 'Pas24234sword', confirmPassword: 'Pas24234sword' }
  var createUserResponse = await netClient.rpc('users', 'create', createUserData, { is_test: true, token: context.tokens.userAdminTest })
  log('createUserResponse', createUserResponse)
  var confirmationCodeResponse = await netClient.rpc('users', 'readEmailConfirmationCode', createUserResponse, { is_test: true, token: context.tokens.userAdminTest })
  log('confirmationCodeResponse', confirmationCodeResponse)
  var confirmEmailResponse = await netClient.rpc('users', 'confirmEmail', { email: createUserData.email, emailConfirmationCode: confirmationCodeResponse.emailConfirmationCode }, { is_test: true, token: context.tokens.userAdminTest })
  log('confirmEmailResponse', confirmEmailResponse)

  await new Promise((resolve) => setTimeout(resolve, 2000))
  mainTest.testRaw('LIVE SESSION QUERY UPDATE', sessionResults, (data) => data.queries[queryListId].indexOf(createUserResponse.id) > -1)
  mainTest.testRaw('LIVE SESSION MUTATION create', sessionResults, (data) => data.mutations.length === 2)

  // mainTest.consoleResume()
  var removeRequestResponse = await apiCallInternal('liveSessionCommands', { commands: [{ command: 'removeRequest', params: { requestId: lastUpdatedResponse[0].data.requestId } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  log('removeRequestResponse', removeRequestResponse)

  var lastUpdatedPage2Response = await apiCallInternal('liveSessionCommands', { commands: [{ command: 'addRequest', params: { query: 'lastUpdated', queryParams: { fields: ['publicName'], from: 20, to: 30 } } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  log('lastUpdatedPage2Response', lastUpdatedPage2Response)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await apiCallInternal('liveSessionCommands', { commands: [{ command: 'removeRequest', params: { requestId: lastUpdatedPage2Response[0].data.requestId } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })

  var lastUpdatedPage3Response = await apiCallInternal('liveSessionCommands', { commands: [{ command: 'addRequest', params: { query: 'lastUpdated', queryParams: { fields: ['publicName'], from: 30, to: 40 } } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  log('lastUpdatedPage3Response', lastUpdatedPage3Response)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await apiCallInternal('liveSessionCommands', { commands: [{ command: 'removeRequest', params: { requestId: lastUpdatedPage3Response[0].data.requestId } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })

  await new Promise((resolve) => setTimeout(resolve, 2000))

  mainTest.testRaw('LIVE SESSION QUERY REMOvED AFTER GARBAGE COLLECTION (3 queries max)', sessionResults, (data) => !data.queries[removeRequestResponse[0].data.removedQueryId])
  // mainTest.consoleResume()
  log('lastUpdatedResponse requestId', { lastUpdatedResponse: lastUpdatedResponse[0].data, lastUpdatedPage2Response: lastUpdatedPage2Response[0].data })
  await new Promise((resolve) => setTimeout(resolve, 2000))

  await apiCallInternal('liveSessionCommands', { commands: [{ command: 'garbageCollection', params: { maxViews: 20 } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  await apiCallInternal('liveSessionCommands', { commands: [{ command: 'garbageCollection', params: { maxViews: 20 } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  await apiCallInternal('liveSessionCommands', { commands: [{ command: 'garbageCollection', params: { maxViews: 20 } }], sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  await new Promise((resolve) => setTimeout(resolve, 2000))

  mainTest.testRaw('LIVE SESSION DIRECT GARBAGE COLLECTION (20views max)', sessionResults, (data) => Object.keys(data.views).length < 20)
  mainTest.consoleResume()

  es.close()
  var partialMutationsNumber = sessionResults.mutations.length
  await netClient.rpc('users', 'updatePersonalInfo', { id: '11111111-1111-1111-1111-111111111111', publicName: 'NewPublicName1', firstName: 'firstName', sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  await new Promise((resolve) => setTimeout(resolve, 1000))
  es = getEvents()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await new Promise((resolve) => setTimeout(resolve, 2000))
  mainTest.testRaw('LIVE SESSION short disconnection (1 sec on keepAlive 3 sec)', sessionResults, (data) => data.mutations.length > partialMutationsNumber)
  mainTest.consoleResume()

  es.close()
  await new Promise((resolve) => setTimeout(resolve, 5000))
  await netClient.rpc('users', 'updatePersonalInfo', { id: '11111111-1111-1111-1111-111111111111', publicName: 'NewPublicName2', firstName: 'firstName', sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  await new Promise((resolve) => setTimeout(resolve, 5000))
  es = getEvents()
  await new Promise((resolve) => setTimeout(resolve, 5000))

  mainTest.testRaw('LIVE SESSION long disconnection (5 sec on keepAlive 3 sec)', sessionResults, (data) => data.views['11111111-1111-1111-1111-111111111111'].publicName === 'NewPublicName2' && data.mutations.resendRequests === 1)
  mainTest.consoleResume()

  // await new Promise((resolve) => setTimeout(resolve, 60000))

  // for (var i = 0; i < 1; i++) await netClient.rpc('users', 'emitEvent', { type: 'mutation', data: { 'objId': '11111111-1111-1111-1111-111111111111', mutation: 'create' } })
  // await new Promise((resolve) => setTimeout(resolve, 1000))

  // console.log('liveQuery Call',)
  // var liveSessionCommandsResults = await apiCallInternal('liveSessionCommands', {  commands: [{ command: 'addRequest', params: { query: 'read', queryParams: { 'id': '11111111-1111-1111-1111-111111111111', fields: ['publicName'] } } }] , sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  // console.log('liveSessionCommandsResults', liveSessionCommandsResults)
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  //
  // var liveSessionCommandsResults = await apiCallInternal('liveSessionCommands', {  commands: [{ command: 'addRequest', params: { query: 'read', queryParams: { 'id': '11111111-1111-1111-1111-111111111111', fields: ['publicName'] } } }] , sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  // console.log('liveSessionCommandsResults', liveSessionCommandsResults)
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  //
  // var liveSessionCommandsResults = await apiCallInternal('liveSessionCommands', {  commands: [{ command: 'addRequest', params: { query: 'list', queryParams: {  fields: ['publicName'] } } }] , sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  // console.log('liveSessionCommandsResults', liveSessionCommandsResults)
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  //
  // var liveSessionCommandsResults = await apiCallInternal('liveSessionCommands', {  commands: [{ command: 'addRequest', params: { query: 'list', queryParams: {  fields: ['publicName'] } } }] , sessionId: sessionId, listenerId: listenerId }, { is_test: true, token: context.tokens.userAdminTest })
  // console.log('liveSessionCommandsResults', liveSessionCommandsResults)

  await new Promise((resolve) => setTimeout(resolve, 5000))

  await context.destroy()

  await new Promise((resolve) => setTimeout(resolve, 5000))
  return mainTest.finish()
}
module.exports = startTest
