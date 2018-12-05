process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'TEST', msg, data])) }
const warn = (msg, data) => { console.log('\n' + JSON.stringify(['WARN', 'TEST', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'TEST', msg, data])) }

process.env.debugMain = true
// process.env.debugCouchbase = true
// process.env.debugJesus = true
// process.env.debugSchema = true

var startTest = async function (netClient) {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var CONFIG = require('../config')

  const auth = require('sint-bit-utils/utils/auth')
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 0)
  mainTest.consoleResume()
  // function getPuppetSubscriptionsGetPermissions (substitutions = {}) {
  //   var defaultSubscription = Object.assign({
  //     id: 'testSubscription',
  //     permissions: ['notificationsWrite', 'notificationsRead', 'notificationsConfirm', 'notificationsWriteOtherNotifications', 'notificationsReadAll'],
  //     dashId: 'testDash',
  //     userId: 'userTest'
  //   }, substitutions)
  //   // mainTest.log('getPuppetSubscriptionsGetPermissions', {substitutions, defaultSubscription})
  //   var func = function ({data}) { return { results: [defaultSubscription] } }
  //   return func
  // }

  async function setContext (contextData) {
    var i
    var tokens = {}
    for (i in contextData.users)tokens[i] = await auth.createToken(i, contextData.users[i], CONFIG.jwt)
    // for (i in contextData.entities) await DB.put('view', Object.assign({ id: 'testDash_testUser', meta: {confirmed: true, created: Date.now(), updated: Date.now()}, dashId: 'testDash', userId: 'testUser' }, contextData.entities[i]))
    for (i in contextData.entities) await DB.put('view', Object.assign({ id: 'testDash_userTest', meta: {confirmed: true, created: Date.now(), updated: Date.now()}, objectId: 'testEntityId', objectType: 'testEntityType', userId: 'userTest' }, contextData.entities[i]))
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
      destroy: async() => {
        for (i in contextData.entities) await DB.remove(contextData.entities[i].id)
      }
    }
  }
  const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
  await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
  const dbGet = (id = 'userTest') => DB.get(id)
  const dbRemove = (id = 'userTest') => DB.remove(id)
  const dbQuery = (where, args) => DB.query('SELECT item.* from notifications item WHERE DOC_TYPE="view" AND ' + where, args)

  mainTest.sectionHead('SERVICE INFO')
  var context = await setContext({users: { userTest: {} }})
  // mainTest.consoleResume()
  var test = await netClient.testLocalMethod('serviceInfo', {}, {token: context.tokens.userTest})
  mainTest.testRaw('SERVICE INFO', test, (data) => data.schema instanceof Object && data.mutations instanceof Object)
  mainTest.log('SERVICE INFO', test)
  await context.destroy()

  mainTest.sectionHead('RAW CREATE')
  var testPuppets = {
    users_readMulti: () => { return {results: [{id: 'userTest', name: 'userTest', email: 'userTest@email.com', tags: ['test'], options: { }, notifications: {email: true, sms: true}}]} },
    emails_addToQueueMulti: () => { return {results: [{'success': 'true', 'id': 'emailQueue'}, {'success': 'true', 'id': 'emailQueue'}]} }
  }
  context = await setContext({
    data: { mutation: 'create', items: [{id: undefined, data: {userId: 'userTest', objectId: 'testEntityId', objectType: 'testEntityType'}}], extend: { } },
    users: { userTest: {} },
    entities: [],
    testPuppets
  })
  mainTest.log('context.data', context.data)
  test = await netClient.testLocalMethod('rawMutateMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('rawMutateMulti create', test, (data) => data.results instanceof Array && data.results.length === 1)
  // mainTest.consoleResume()
  mainTest.testRaw('rawMutateMulti create dbCheck', await dbGet(test.results[0].id), (data) => data.userId === 'userTest')
  mainTest.log('rawMutateMulti', test)
  await dbRemove(test.results[0].id)
  await context.destroy()

  mainTest.sectionHead('CREATE ADN SET READED')

  context = await setContext({
    data: { items: [{ userId: 'userTest', objectId: 'testEntityId', objectType: 'testEntityType', data: {'testData': 'testData'}, sendTo: [{channel: 'email', options: {template: 'testTemplate'}}] }] },
    users: { userTest: {} },
    entities: [],
    testPuppets
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  // mainTest.consoleResume()

  // var results = await DB.query('notificationsViews', 'DELETE FROM notificationsViews WHERE email="test@test.com" LIMIT 1', [])
  // DELETE FROM notificationsViews WHERE email=testEmail
  // mainTest.consoleResume()
  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti', test, (data) => data.results instanceof Array && data.results.length === 1 && !data.errors)
  mainTest.testRaw('createMulti dbCheck', await dbGet(test.results[0].id), (data) => data.userId === 'userTest')
  var resultId = test.results[0].id
  await new Promise((resolve) => setTimeout(resolve, 500))
  mainTest.log('createMulti context', context)

  test = await netClient.testLocalMethod('readed', {id: resultId}, {token: context.tokens.userTest})
  mainTest.testRaw('readed', test, (data) => data.success && !data.errors)

  test = await netClient.testLocalMethod('readedByObjectId', {objectId: 'testEntityId', objectType: 'testEntityType'}, {token: context.tokens.userTest})
  mainTest.testRaw('readedByObjectId', test, (data) => data.success && !data.errors)

  await context.destroy()

  mainTest.sectionHead('READ')

  context = await setContext({
    data: {},
    users: { userTest: {} },
    entities: [{ id: 'notificationTest', userId: 'userTest', objectId: 'testEntityId', objectType: 'testEntityType', data: {'testData': 'testData'} }],
    testPuppets// testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  test = await netClient.testLocalMethod('readMulti', { ids: ['notificationTest'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)

  test = await netClient.testLocalMethod('readMulti', { ids: ['fakeid'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti checkError  Notification not exists', test, (data) => data.errors instanceof Array)

  await context.destroy()

  mainTest.sectionHead('UPDATE')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {permissions: ['notificationsWrite']} },
    entities: [
      { id: 'notificationTest', userId: 'userTest', objectId: 'testEntityId', objectType: 'testEntityType', data: {'testData': 'testData'} },
      { id: 'notificationTest1', userId: 'userTest1', objectId: 'testEntityId', objectType: 'testEntityType', data: {'testData': 'testData'} }
    ],
    testPuppets
  })

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'notificationTest', tags: ['testUpdate']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  // dbCheck = await DB.get('notificationsViews', 'userTest')
  mainTest.testRaw('updateMulti dbCheck', await dbGet('notificationTest'), (data) => data.tags[0] === 'testUpdate')

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'fake', tags: ['test']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti checkError  Notification not exists', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'notificationTest1', tags: ['test']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti checkError  Cant update other notifications notification', test, (data) => data.errors instanceof Array)

  // context.updatePuppets({subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['notificationsWrite', 'notificationsRead', 'notificationsWriteOtherNotifications']})})
  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'notificationTest1', tags: ['test']}] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('updateMulti checkError  notificationsWrite can update other notifications notification', test, (data) => !data.errors)

  await context.destroy()

  mainTest.sectionHead('DELETE')

  context = await setContext({
    data: {},
    users: { userTest: {}, userTest1: {}, userAdminTest: {permissions: ['notificationsWrite', 'notificationsReadAll', 'notificationsList']} },
    entities: [
      { id: 'notificationTest', userId: 'userTest', objectId: 'testEntityId', objectType: 'testEntityType', data: {'testData': 'testData'} }
    ],
    testPuppets
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['notificationsWrite', 'notificationsRead']}) }
  })

  test = await netClient.testLocalMethod('deleteMulti', { ids: ['notificationTest'] }, {token: context.tokens.userTest})
  mainTest.log('test', test)
  mainTest.testRaw('deleteMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('deleteMulti dbCheck', await dbGet('notificationTest'), (data) => data.deleted === true)

  test = await netClient.testLocalMethod('readMulti', { ids: ['notificationTest'] }, {token: context.tokens.userTest1})
  mainTest.testRaw('readMulti checkError readMulti Notification deleted', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('readMulti', { ids: ['notificationTest'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti check Notification deleted but readable by owner', test, (data) => !data.errors)

  // context.updatePuppets({subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['notificationsWrite', 'notificationsRead', 'notificationsReadAll', 'notificationsWriteOtherNotifications']})})
  test = await netClient.testLocalMethod('readMulti', { ids: ['notificationTest'] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('readMulti check  Notification deleted but readable by admins', test, (data) => !data.errors)

  await context.destroy()

  mainTest.sectionHead('LIST')

  context = await setContext({
    data: {},
    users: { userListTest: {}, userListTest1: {}, userListAdminTest: {permissions: ['notificationsWrite', 'notificationsReadAll', 'notificationsList']} },
    entities: [
      { id: 'notificationTest', userId: 'userListTest', objectId: 'testEntityId', objectType: 'testEntityType', data: {'testData': 'testData'} },
      { id: 'notificationTest1', userId: 'userListTest1', objectId: 'testEntityId', objectType: 'testEntityType', data: {'testData': 'testData'} },
      { id: 'notificationTest2', userId: 'userListTest', objectId: 'testEntityId', objectType: 'testEntityType', data: {'testData': 'testData'} }
    ],
    testPuppets
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  await new Promise((resolve) => setTimeout(resolve, 1000)) // DB INDEX UPDATE
  test = await netClient.testLocalMethod('list', {}, {token: context.tokens.userListAdminTest})
  mainTest.testRaw('list', test, (data) => !data.error && data.results instanceof Array && data.results.length >= 2)

  test = await netClient.testLocalMethod('list', {}, {token: context.tokens.userListTest})
  mainTest.testRaw('list', test, (data) => data.error)

  test = await netClient.testLocalMethod('listByUserId', {userId: 'userListTest'}, {token: context.tokens.userListTest})
  mainTest.testRaw('listByUserId userTest', test, (data) => !data.error && data.results instanceof Array && data.results.length === 2)

  test = await netClient.testLocalMethod('listByUserId', {userId: 'userListTest'}, {token: context.tokens.userListTest1})
  mainTest.testRaw('listByUserId userTest1', test, (data) => data.error)

  test = await netClient.testLocalMethod('listByUserId', {userId: 'userListTest'}, {token: context.tokens.userListAdminTest})
  mainTest.testRaw('listByUserId userAdminTest', test, (data) => !data.error && data.results instanceof Array && data.results.length === 2)

  await context.destroy()

  // mainTest.sectionHead('POST EVENT')
  //
  // context = await setContext({
  //   data: {},
  //   users: { userPostEventTest: {}, userPostEventTest1: {}, userPostEventAdminTest: {permissions: ['notificationsWrite', 'notificationsReadAll', 'notificationsList']} },
  //   entities: [
  //     // { id: 'notificationTest', userId: 'userListTest', objectId: 'testTag', data: {'testData': 'testData'} },
  //     // { id: 'notificationTest1', userId: 'userListTest1', objectId: 'testTag', data: {'testData': 'testData'} },
  //     // { id: 'notificationTest2', userId: 'userListTest', objectId: 'testTag', data: {'testData': 'testData'} }
  //   ],
  //   testPuppets
  //   // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  // })
  // var notificationsEventCreatePost = await netClient.emit('TEST_POST_EVENT', { view: { body: 'Test Post', id: 'testPostId' }, users: ['userPostEventTest'] }, {token: context.tokens.userPostEventTest})
  // mainTest.log('notificationsEventCreatePost', notificationsEventCreatePost)
  // // mainTest.consoleResume()
  // var queryResults = await dbQuery('userId=$1', ['userPostEventTest'])
  // queryResults.forEach((item) => dbRemove(item.id))
  // mainTest.testRaw('postEvent dbCheck', queryResults, (list) => list.length === 1)
  // await context.destroy()

  await new Promise((resolve) => setTimeout(resolve, 1000))
  return mainTest.finish()
}
module.exports = startTest
