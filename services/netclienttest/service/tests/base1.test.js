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
// process.env.debugCouchbase = true
// process.env.debugJesus = true
// process.env.debugSchema = true

var startTest = async function (netClient) {
  var apiCall = async (method, data, meta, asStream, returnRaw) => {
    // log('apiCall', {method, data, meta})
    var headers = {}
    for (var i in meta)headers['app-meta-' + i] = meta[i]
    // log('apiCall headers', {meta, headers})
    headers['Content-Type'] = 'multipart/form-data'
    var request = require('request-promise-native')
    try {
      log('apiCall', {method, data})
      var raw = await request.post({url: 'http://127.0.0.1/' + method, formData: data, headers})
      if (returnRaw) return raw
      var response = JSON.parse(raw)

      return response
    } catch (err) {
      return err
    }
  }
  var apiCallInternal = async (method, data, meta, asStream) => {
    var response = await netClient.rpc('civil-microservices_users', method, data, meta, asStream)
    // log('apiCallInternal response', {response})
    return response
  }

  await new Promise((resolve) => setTimeout(resolve, 1000))
  var CONFIG = require('../config')
  const auth = require('sint-bit-utils/utils/auth')
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 1)
  // mainTest.consoleResume()
  // function getPuppetSubscriptionsGetPermissions (substitutions = {}) {
  //   var defaultSubscription = Object.assign({
  //     id: 'testSubscription',
  //     permissions: ['usersWrite', 'usersRead', 'usersConfirm', 'usersWriteOtherUsers', 'usersReadAll'],
  //     dashId: 'testDash',
  //     userId: '11111111-1111-1111-1111-111111111111'
  //   }, substitutions)
  //   // mainTest.log('getPuppetSubscriptionsGetPermissions', {substitutions, defaultSubscription})
  //   var func = function ({data}) { return { results: [defaultSubscription] } }
  //   return func
  // }

  async function setContext (contextData) {
    var i
    var tokens = {}
    for (i in contextData.users)tokens[i] = await auth.createToken(i, contextData.users[i], CONFIG.jwt)
    for (i in contextData.entities) await DB.put('view', Object.assign({ id: 'testDash_11111111-1111-1111-1111-111111111111', VIEW_META: { created: Date.now(), updated: Date.now() } }, contextData.entities[i]))
    Object.assign(netClient.testPuppets, contextData.testPuppets || {})
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
      updatePuppets: (testPuppets) => Object.assign(netClient.testPuppets, testPuppets || {}),
      destroy: async () => {
        for (i in contextData.entities) await DB.remove('usersViews', contextData.entities[i].id)
      }
    }
  }
  const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
  await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
  const dbGet = (id = '11111111-1111-1111-1111-111111111111') => DB.get(id)
  const dbRemove = (id = '11111111-1111-1111-1111-111111111111') => DB.remove(id)

  var microRandom = Math.floor(Math.random() * 100000)
  var testEmail = `test${microRandom}@test.com`

  mainTest.sectionHead('SERVICE AUTOTEST')
  // mainTest.consoleResume()
  var context = await setContext({ data: { }, users: { '11111111-1111-1111-1111-111111111111': {permissions: ['dashboardsCreate']} }, entities: [] })
  var test = await apiCallInternal('autotest', {}, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('SERVICE AUTOTEST', test, (data) => data.success)
  await context.destroy()

  mainTest.sectionHead('SERVICE INFO')
  // mainTest.consoleResume()
  var context = await setContext({ data: { }, users: { '11111111-1111-1111-1111-111111111111': {permissions: ['dashboardsCreate']} }, entities: [] })
  var test = await apiCall('serviceInfo', {}, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  var test2 = await apiCallInternal('serviceInfo', {}, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('SERVICE INFO', test, (data) => data.schema instanceof Object && data.mutations instanceof Object)
  await context.destroy()

  mainTest.sectionHead('GET EVENTS')
  // mainTest.consoleResume()
  context = await setContext({ data: { }, users: { '11111111-1111-1111-1111-111111111111': {permissions: ['dashboardsCreate']} }, entities: [] })
  test = await apiCallInternal('getEvents', {type: 'log'}, {token: context.tokens['11111111-1111-1111-1111-111111111111']}, true)
  var eventsCounter = 0
  test.on('data', (data) => { log('test getEvents stream ondata >>>', data); eventsCounter++ })
  for (var i = 0; i < 10; i++) await apiCallInternal('emitEvent', {type: 'log', data: {'test': i}}, {token: context.tokens['11111111-1111-1111-1111-111111111111']}, true)
  await test.end()
  await new Promise((resolve) => setTimeout(resolve, 1000))
  mainTest.testRaw('GET EVENTS', eventsCounter, (data) => data === 10)
  await context.destroy()

  // mainTest.consoleResume()
  context = await setContext({ data: { }, users: { '11111111-1111-1111-1111-111111111111': {permissions: ['dashboardsCreate']} }, entities: [] })
  var test1 = await apiCallInternal('getEvents', {type: 'log', service: 'test'}, {token: context.tokens['11111111-1111-1111-1111-111111111111']}, true)
  var test2 = await apiCallInternal('getEvents', {type: 'log', service: 'test'}, {token: context.tokens['11111111-1111-1111-1111-111111111111']}, true)
  eventsCounter = 0
  test1.on('data', (data) => { log('test1 getEvents stream ondata >>>', data); eventsCounter++ })
  test2.on('data', (data) => { log('test2 getEvents stream ondata >>>', data); eventsCounter++ })
  for (i = 0; i < 10; i++) await apiCallInternal('emitEvent', {type: 'log', data: {'test': i}}, {token: context.tokens['11111111-1111-1111-1111-111111111111']}, true)
  await test1.end()
  await test2.end()
  await new Promise((resolve) => setTimeout(resolve, 1000))
  mainTest.testRaw('GET EVENTS', eventsCounter, (data) => data === 10)
  await context.destroy()

  mainTest.sectionHead('RAW CREATE')
  // mainTest.consoleResume()
  var context = await setContext({
    data: { mutation: 'create', id: undefined, data: { email: testEmail, password: 'password', confirmPassword: 'password' } },
    users: { '11111111-1111-1111-1111-111111111111': {} },
    entities: []
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  var test = await apiCallInternal('rawMutate', context.data, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('rawMutate create', test, (data) => data.success)
  // mainTest.consoleResume()

  mainTest.testRaw('rawMutate create dbCheck', await dbGet(test.id), (data) => data.email === testEmail)
  // mainTest.consoleResume()
  // mainTest.log('rawMutate', test)

  await dbRemove(test.id)
  await context.destroy()

  mainTest.sectionHead('REGISTRATION AND LOGIN')

  context = await setContext({
    data: { email: testEmail, tags: ['testTag'], password: 'password', confirmPassword: 'password' },
    users: { '11111111-1111-1111-1111-111111111111': {} },
    entities: []
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  // mainTest.consoleResume()

  // var results = await DB.query('usersViews', 'DELETE FROM usersViews WHERE email="test@test.com" LIMIT 1', [])
  // DELETE FROM usersViews WHERE email=testEmail
  test = await apiCallInternal('create', context.data, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('create', test, (data) => data.success && !data.error)
  // mainTest.consoleResume()
  mainTest.testRaw('create dbCheck', await dbGet(test.id), (data) => data.email === testEmail && data.emailConfirmed === false)
  var resultId = test.id
  await new Promise((resolve) => setTimeout(resolve, 1000))

  test = await apiCallInternal('create', context.data, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('create wrong request: User exists', test, (data) => data.error)

  test = await apiCallInternal('create', { email: 'fakeemail' }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('create wrong request: email not valid', test, (data) => data.error)

  // mainTest.consoleResume()
  test = await apiCallInternal('readEmailConfirmationCode', {id: resultId}, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('readEmailConfirmationCode', test, (data) => data.emailConfirmationCode && !data.error)
  //
  test = await apiCall('confirmEmail', {email: testEmail, emailConfirmationCode: test.emailConfirmationCode}, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('confirmEmail', test, (data) => data.success && !data.error)
  mainTest.testRaw('confirmEmail dbCheck', await dbGet(resultId), (data) => data.emailConfirmed === true)

  // test = await apiCall('assignPassword', {email: testEmail, password: 'password', confirmPassword: 'password'}, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  // mainTest.testRaw('assignPassword', test, (data) => data.success && !data.error)
  // mainTest.testRaw('assignPassword dbCheck', await dbGet(resultId), (data) => data.passwordAssigned === true)

  // mainTest.consoleResume()
  test = await apiCall('login', {email: testEmail, password: 'password'}, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('login', test, (data) => data.data.token && data.success && !data.error)
  // mainTest.log('login', test)
  var loginToken = test.data.token

  mainTest.log(' dbCheck', await dbGet(resultId))

  test = await apiCall('updatePersonalInfo', {id: resultId, publicName: 'NewPublicName', firstName: 'firstName'}, {token: loginToken})
  mainTest.testRaw('updatePersonalInfo', test, (data) => data.success && !data.error)
  mainTest.testRaw('updatePersonalInfo dbCheck', await dbGet(resultId), (data) => data.publicName === 'NewPublicName' && data.firstName === 'firstName')

  // mainTest.consoleResume()
  test = await apiCall('refreshToken', {}, {token: loginToken})
  mainTest.testRaw('refreshToken', test, (data) => data.success && !data.error && data.data.token)
  // mainTest.log('refreshToken', test)
  // mainTest.testRaw('refreshToken dbCheck', await dbGet(resultId), (data) => typeof (data.token) === 'string')
  loginToken = test.data.token

  mainTest.sectionHead('PIC')

  var path = require('path')
  var fs = require('fs')
  // mainTest.consoleResume()
  // fs.createReadStream(path.join(__dirname, '/test.png')).pipe(fs.createWriteStream(path.join(__dirname, '/test_send.png')))
  test = await apiCall('addPic', {id: resultId, pic: fs.createReadStream(__dirname + '/test.png')}, {token: loginToken})
  mainTest.testRaw('addPic', test, (data) => data.success && !data.error)
  mainTest.testRaw('addPic dbCheck', await dbGet(resultId), (data) => Object.keys(data.pics).length === 1)

  var picId = test.data.picId
  test = await apiCall('getPic', {id: picId, size: 'full'}, {token: loginToken}, false, true)
  mainTest.testRaw('getPic', test, (data) => typeof data === 'string', 0)

  test = await apiCall('deletePic', {id: picId}, {token: loginToken})
  mainTest.testRaw('deletePic', test, (data) => data.success && !data.error)
  mainTest.testRaw('deletePic dbCheck on user ', await dbGet(resultId), (data) => Object.keys(data.pics).length === 0)
  mainTest.testRaw('deletePic dbCheck on pic meta', await dbGet(resultId), (data) => Object.keys(data.pics).length === 0)

  test = await apiCall('getPic', {id: picId, size: 'full'}, {token: loginToken})
  mainTest.testRaw('getPic deleted', test, (data) => !data.success && data.error)

  test = await apiCall('updatePassword', {id: resultId, password: 'new_pass', confirmPassword: 'new_pass', oldPassword: 'password'}, {token: loginToken})
  mainTest.testRaw('updatePassword', test, (data) => data.success && !data.error)

  await dbRemove(resultId)
  await context.destroy()

  mainTest.sectionHead('GUEST')

  context = await setContext({
    data: {},
    users: { '11111111-1111-1111-1111-111111111111': {} }
    // entities: [{'id': '11111111-1111-1111-1111-111111111111', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'meta': {'created': 1516090275074, 'updated': 1516090275232}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW',  'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'}]
  })
  test = await apiCall('createGuest', { 'publicName': 'guest', 'email': 'createGuest@test.com' }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('createGuest', test, (data) => !data.error && data.data.token && data.data.password)

  await dbRemove(test.id)
  await context.destroy()

  mainTest.sectionHead('READ')
  // mainTest.consoleResume()
  context = await setContext({
    data: {},
    users: { '11111111-1111-1111-1111-111111111111': {} },
    entities: [{'id': '11111111-1111-1111-1111-111111111111', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'meta': {'created': 1516090275074, 'updated': 1516090275232}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'}]
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  // log('READ', await dbGet('11111111-1111-1111-1111-111111111111'))
  test = await apiCall('read', { id: '11111111-1111-1111-1111-111111111111' }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('read', test, (data) => !data.error && data.success && !data.partial)

  test = await apiCall('read', { id: '11111111-1111-1111-1111-111111111111', fields: ['publicName'] }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('readPartial', test, (data) => !data.error && data.success && data.partial && data.view.publicName && !data.email)

  // mainTest.consoleResume()
  test = await apiCall('read', { id: '12341111-1111-1111-1111-111111111111' }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('read checkError  User not exists', test, (data) => data.error)

  mainTest.consoleResume()
  await context.destroy()

  mainTest.sectionHead('UPDATE')
  context = await setContext({
    data: {},
    users: { '11111111-1111-1111-1111-111111111111': {}, userAdminTest: {permissions: ['usersWrite']} },
    entities: [
      {'id': '11111111-1111-1111-1111-111111111111', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'meta': {'created': 1516090275074, 'updated': 1516090275232}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'},
      {'id': '22222222-2222-2222-2222-222222222222', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'meta': {'created': 1516090275074, 'updated': 1516090275232}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'}
    ]
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['usersWrite', 'usersRead']}) }
  })

  test = await apiCall('update', {id: '11111111-1111-1111-1111-111111111111', tags: ['testUpdate', 'testUpdate2']}, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('update', test, (data) => !data.error && data.success)
  // dbCheck = await DB.get('usersViews', '11111111-1111-1111-1111-111111111111')
  mainTest.testRaw('update dbCheck', await dbGet('11111111-1111-1111-1111-111111111111'), (data) => data.tags[0] === 'testUpdate')

  // mainTest.consoleResume()
  test = await apiCall('update', {id: '12341111-1111-1111-1111-111111111111', tags: ['test']}, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('update checkError  User not exists', test, (data) => data.error)

  test = await apiCall('update', { id: '22222222-2222-2222-2222-222222222222', tags: ['test'] }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('update checkError  Cant update other users user', test, (data) => data.error)

  // context.updatePuppets({subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['usersWrite', 'usersRead', 'usersWriteOtherUsers']})})
  test = await apiCall('update', { id: '22222222-2222-2222-2222-222222222222', tags: ['test'] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('update checkError  usersWrite can update other users user', test, (data) => !data.error)

  await context.destroy()

  mainTest.sectionHead('DELETE')

  context = await setContext({
    data: {},
    users: { '11111111-1111-1111-1111-111111111111': {}, userAdminTest: {permissions: ['usersWrite', 'usersReadAll', 'usersList']} },
    entities: [
      {'id': '11111111-1111-1111-1111-111111111111', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'meta': {'created': 1516090275074, 'updated': 1516090275232}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'},
      {'id': '22222222-2222-2222-2222-222222222222', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'meta': {'created': 1516090275074, 'updated': 1516090275232}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'}
    ]
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['usersWrite', 'usersRead']}) }
  })

  test = await apiCall('delete', { id: '11111111-1111-1111-1111-111111111111' }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  // mainTest.log('test', test)
  mainTest.testRaw('delete', test, (data) => !data.error && data.success)
  mainTest.testRaw('delete dbCheck', await dbGet('11111111-1111-1111-1111-111111111111'), (data) => data.deleted === true)

  test = await apiCall('read', { id: '22222222-2222-2222-2222-222222222222' }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('read checkError read User deleted', test, (data) => data.error)

  test = await apiCall('read', { id: '11111111-1111-1111-1111-111111111111' }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('read check User deleted but readable by owner', test, (data) => !data.error)

  // context.updatePuppets({subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['usersWrite', 'usersRead', 'usersReadAll', 'usersWriteOtherUsers']})})
  test = await apiCall('read', { id: '22222222-2222-2222-2222-222222222222' }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('read check  User deleted but readable by admins', test, (data) => !data.error)

  await context.destroy()

  // mainTest.sectionHead('CONFIRMATIONS')
  //
  // context = await setContext({
  //   data: {},
  //   users: { '11111111-1111-1111-1111-111111111111': {}, userAdminTest: {} },
  //   entities: [
  //   ]
  //   // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['usersWrite', 'usersRead']}) }
  // })
  //
  // test = await apiCall('create', { items: [{ email: testEmail, tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] }] }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  // mainTest.testRaw('create with confirmation', test, (data) => !data.error && data.results instanceof Array && data.results.length === 1)
  // mainTest.testRaw('create with confirmation dbCheck', await dbGet(test.id), (data) => !data.confirmed)
  // var tempId = test.id
  // test = await apiCall('confirm', { ids: [test.id] }, {token: context.tokens.userAdminTest})
  // mainTest.testRaw('confirm by admin user', test, (data) => !data.error && data.results instanceof Array && data.results.length === 1)
  // mainTest.testRaw('confirm dbCheck', await dbGet(test.id), (data) => data.confirmed === true)
  // await dbRemove(tempId)
  // await context.destroy()

  mainTest.sectionHead('TAGS')

  context = await setContext({
    data: {},
    users: { '11111111-1111-1111-1111-111111111111': {}, userAdminTest: {permissions: ['usersWrite', 'usersReadAll', 'usersList']} },
    entities: [
      {'id': '11111111-1111-1111-1111-111111111111', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'meta': {'created': 1516090275074, 'updated': 1516090275232}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'},
      {'id': '22222222-2222-2222-2222-222222222222', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'meta': {'created': 1516090275074, 'updated': 1516090275232}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'}
    ]
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })

  test = await apiCall('addTags', { id: '11111111-1111-1111-1111-111111111111', tags: ['tag_by_subscriber', 'tag_by_subscriber2'] }, {token: context.tokens['11111111-1111-1111-1111-111111111111']})
  mainTest.testRaw('addTags by subcritpion owner', test, (data) => !data.error && data.success)
  mainTest.testRaw('addTags by subcritpion owner dbCheck', await dbGet('11111111-1111-1111-1111-111111111111'), (data) => data.tags.indexOf('tag_by_subscriber') > -1)

  test = await apiCall('addTags', { id: '11111111-1111-1111-1111-111111111111', tags: ['tag_by_admin', 'tag_by_admin2'] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('addTags by admin', test, (data) => !data.error && data.success)
  mainTest.testRaw('addTags by admin  dbCheck', await dbGet('11111111-1111-1111-1111-111111111111'), (data) => data.tags.indexOf('tag_by_admin') > -1)

  await context.destroy()

  mainTest.sectionHead('LIST')

  context = await setContext({
    data: {},
    users: { '11111111-1111-1111-1111-111111111111': {}, userAdminTest: {permissions: ['usersWrite', 'usersReadAll', 'usersList']} },
    entities: [
      {'id': '11111111-1111-1111-1111-111111111111', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'VIEW_META': {'created': 1516090275074, 'updated': 200000000000000000000}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'},
      {'id': '22222222-2222-2222-2222-222222222222', 'email': 'test23644@test.com', 'emailConfirmationCode': '4c1d589d-44fe-439f-9b82-faa6c4d2cbd5', 'emailConfirmed': true, 'logins': 1, 'logouts': 0, 'VIEW_META': {'created': 1516090275074, 'updated': 100000000000000000000}, 'password': '$2a$10$84WUzaDciJuIz.b/S3kcPesWNZHqXlcHyOmerIUGqUpm3lAUdtqYW', 'permissions': [], 'personalInfo': {}, 'pics': {}, 'publicName': 'test23644'}
    ]
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  await new Promise((resolve) => setTimeout(resolve, 1000)) // DB INDEX UPDATE
  test = await apiCall('list', { }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('list', test, (data) => !data.error && data.results instanceof Array && data.results.length >= 2 && data.results[0].publicName && data.results[0].email)

  test = await apiCall('list', { fields: ['publicName'] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('list fields', test, (data) => !data.error && data.results instanceof Array && data.results[0].publicName && !data.results[0].email)

  test = await apiCall('list', { loadIfUpdatedAfter: 100000000000000000000 }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('list loadIfUpdatedAfter', test, (data) => !data.error && data.results instanceof Array && typeof (data.results[0]) === 'object' && typeof (data.results[1]) === 'string')

  await context.destroy()

  await new Promise((resolve) => setTimeout(resolve, 1000))
  return mainTest.finish()
}
module.exports = startTest
