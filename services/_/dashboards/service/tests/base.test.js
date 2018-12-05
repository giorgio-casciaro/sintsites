process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'TEST', msg, data])) }
const warn = (msg, data) => { console.log('\n' + JSON.stringify(['WARN', 'TEST', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'TEST', msg, data])) }

process.env.debugMain = true
process.env.debugCouchbase = true
process.env.debugJesus = true
process.env.debugSchema = true
var startTest = async function (netClient) {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var CONFIG = require('../config')

  const auth = require('sint-bit-utils/utils/auth')
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 0)
  mainTest.log('RAW CREATE')
  mainTest.consoleResume()
  // function getPuppetSubscriptionsGetPermissions (substitutions = {}) {
  //   var defaultSubscription = Object.assign({
  //     id: 'testSubscription',
  //     permissions: ['dashboardsWrite', 'dashboardsRead', 'dashboardsConfirm', 'dashboardsWriteOtherDashboards', 'dashboardsReadAll'],
  //     dashId: 'testDash',
  //     userId: 'userTest'
  //   }, substitutions)
  //   // mainTest.log('getPuppetSubscriptionsGetPermissions', {substitutions, defaultSubscription})
  //   var func = function ({data}) { return { results: [defaultSubscription] } }
  //   return func
  // }
  var roles = {
    admin: { id: 'admin', name: 'Admin', public: 0, description: 'Main dashboard administrators', permissions: ['dashboardsWrite', 'dashboardsRead', 'dashboardsList', 'subscriptionsRead', 'subscriptionsReadAll', 'postsWrite', 'postsRead', 'postsConfirms', 'postsReadAll', 'postsWriteOtherUsers'] },
    postsAdmin: { id: 'postsAdmin', name: 'Posts Admin', public: 0, description: 'Dashboard posts admin', permissions: ['dashboardsRead', 'postsWrite', 'postsRead', 'postsWriteOtherUsers', 'postsConfirms', 'postsRead', 'subscriptionsRead', 'subscriptionsReadAll'] },
    subscriber: { id: 'subscriber', name: 'Subscriber', public: 1, description: 'Dashboard subscribers', permissions: ['dashboardsRead', 'postsRead', 'subscriptionsRead'] },
    guest: { id: 'guest', name: 'Guest', public: 0, description: 'Dashboard guests, No Role', permissions: [] }
  }
  async function setContext (contextData) {
    var i
    var tokens = {}
    for (i in contextData.users)tokens[i] = await auth.createToken(i, contextData.users[i], CONFIG.jwt)
    for (i in contextData.entities) {
      await DB.put('view', Object.assign({
        id: 'testDash_userTest',
        roles,
        pics: {},
        meta: {confirmed: true, created: Date.now(), updated: Date.now()},
        options: {
          guestRead: 'allow',
          guestSubscribe: 'allow',
          guestWrite: 'confirm',
          subscriberWrite: 'allow'
        }}, contextData.entities[i]))
    }
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

  mainTest.sectionHead('SERVICE INFO')
  var context = await setContext({ data: { }, users: { userTest: {permissions: ['dashboardsCreate']} }, entities: [] })
  var test = await netClient.testLocalMethod('serviceInfo', {}, {token: context.tokens.userTest})
  mainTest.testRaw('SERVICE INFO', test, (data) => data.schema instanceof Object && data.mutations instanceof Object)
  await context.destroy()
  // mainTest.log('SERVICE INFO', test)

  mainTest.sectionHead('RAW CREATE')
  // var jsProp = { id: {type: 'string'}, name: { type: 'string' }, description: { type: 'string' }, options: { type: 'object' }, tags, maps, public: { type: 'boolean' }, pics, meta, roles: {type: 'object'} }

  context = await setContext({
    data: { mutation: 'create', items: [{id: undefined, data: {name: 'name', description: 'description', tags: ['tag1', 'tag2']}}], extend: { } },
    users: { userTest: {permissions: ['dashboardsCreate']} },
    entities: []
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  mainTest.log('context.data', context.data)
  test = await netClient.testLocalMethod('rawMutateMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('rawMutateMulti create', test, (data) => data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('rawMutateMulti create dbCheck', await dbGet(test.results[0].id), (data) => data.description === 'description')
  mainTest.log('rawMutateMulti', test)
  await dbRemove(test.results[0].id)
  await context.destroy()

  mainTest.sectionHead('CREATE')

  context = await setContext({
    data: { items: [{ id: 'dashboardTest', name: 'name', description: 'description', tags: ['tag1', 'tag2'] }] },
    users: { userTest: {permissions: ['dashboardsCreate']} },
    entities: [],
    testPuppets: {
      subscriptions_createMulti: () => ({results: [{success: 'subscription created', id: 'testSubscription'}]}),
      subscriptions_listByUserId: () => ({results: [{dashId: 'dashboardTest', roleId: 'admin', id: 'testSubscription'}]})
    }
  })
  // mainTest.consoleResume()
  // var results = await DB.query('dashboardsViews', 'DELETE FROM dashboardsViews WHERE email="test@test.com" LIMIT 1', [])
  // DELETE FROM dashboardsViews WHERE email=testEmail
  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.log('test', test)
  mainTest.testRaw('createMulti', test, (data) => data.results instanceof Array && data.results.length === 1 && !data.errors)
  mainTest.testRaw('createMulti dbCheck', await dbGet(test.results[0].id), (data) => data.description === 'description')
  var resultId = test.results[0].id
  await new Promise((resolve) => setTimeout(resolve, 500))

  // test = await netClient.testLocalMethod('readed', {id: resultId}, {token: context.tokens.userTest})
  // mainTest.testRaw('readed', test, (data) => data.success && !data.errors)
  //
  // test = await netClient.testLocalMethod('readedByObjectId', {objectId: 'testTag'}, {token: context.tokens.userTest})
  // mainTest.testRaw('readedByObjectId', test, (data) => data.success && !data.errors)

  await context.destroy()

  mainTest.sectionHead('READ')

  context = await setContext({
    data: {},
    users: { userTest: {} },
    entities: [{ id: 'dashboardTest', name: 'name', description: 'description', tags: ['tag1', 'tag2'] }]
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  test = await netClient.testLocalMethod('readMulti', { ids: ['dashboardTest'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)

  test = await netClient.testLocalMethod('readMulti', { ids: ['fakeid'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti checkError  Dashboard not exists', test, (data) => data.errors instanceof Array)

  await context.destroy()

  mainTest.sectionHead('UPDATE')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {permissions: ['dashboardsWrite']} },
    entities: [
        { id: 'dashboardTest', name: 'name', description: 'description', tags: ['tag1', 'tag2'], roles },
        { id: 'dashboardTest1', name: 'name', description: 'description', tags: ['tag1', 'tag2'], roles }
    ],
    testPuppets: {
      subscriptions_listByUserId: () => ({results: [{dashId: 'dashboardTest', roleId: 'admin', id: 'testSubscription'}]})
    }
  })

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'dashboardTest', tags: ['testUpdate']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)

  mainTest.log('test', test)

    // dbCheck = await DB.get('dashboardsViews', 'userTest')
  mainTest.testRaw('updateMulti dbCheck', await dbGet('dashboardTest'), (data) => data.tags[0] === 'testUpdate')

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'fake', tags: ['test']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti checkError  Dashboard not exists', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'dashboardTest1', tags: ['test']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti checkError  Cant update other dashboards dashboard', test, (data) => data.errors instanceof Array)

    // context.updatePuppets({subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['dashboardsWrite', 'dashboardsRead', 'dashboardsWriteOtherDashboards']})})
    // test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'dashboardTest1', tags: ['test']}] }, {token: context.tokens.userAdminTest})
    // mainTest.testRaw('updateMulti checkError  dashboardsWrite can update other dashboards dashboard', test, (data) => !data.errors)
    //
  await context.destroy()

  mainTest.sectionHead('OPTIONS')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {permissions: ['dashboardsWrite']} },
    entities: [
          { id: 'dashboardTest1', name: 'name', description: 'description', tags: ['tag1', 'tag2'], options: { guestRead: 'allow', guestSubscribe: 'allow', guestWrite: 'confirm', subscriberWrite: 'allow' } },
          { id: 'dashboardTest2', name: 'name', description: 'description', tags: ['tag1', 'tag2'], options: { guestRead: 'allow', guestSubscribe: 'deny', guestWrite: 'deny', subscriberWrite: 'allow' } },
          { id: 'dashboardTest3', name: 'name', description: 'description', tags: ['tag1', 'tag2'], options: { guestRead: 'deny', guestSubscribe: 'allow', guestWrite: 'deny', subscriberWrite: 'allow' } },
          { id: 'dashboardTest4', name: 'name', description: 'description', tags: ['tag1', 'tag2'], options: { guestRead: 'allow', guestSubscribe: 'confirm', guestWrite: 'deny', subscriberWrite: 'confirm' } }
    ],
    testPuppets: {
      subscriptions_listByUserId: () => ({results: [{dashId: 'dashboardTest', roleId: 'admin', id: 'testSubscription'}]})
    }
  })

  test = await netClient.testLocalMethod('readMulti', { ids: ['dashboardTest1'] }, {token: context.tokens.userTest})
  mainTest.testRaw('check roles permissions based on options - 1', test, (data) => !data.errors && data.results[0].roles.guest.permissions.includes('postsWrite') && data.results[0].roles.guest.permissions.includes('postsRead') && data.results[0].roles.guest.permissions.includes('subscriptionsConfirm') && data.results[0].roles.subscriber.permissions.includes('postsConfirm'))
  test = await netClient.testLocalMethod('readMulti', { ids: ['dashboardTest2'] }, {token: context.tokens.userTest})
  mainTest.testRaw('check roles permissions based on options - 2', test, (data) => !data.errors && !data.results[0].roles.guest.permissions.includes('postsWrite') && data.results[0].roles.guest.permissions.includes('postsRead') && !data.results[0].roles.guest.permissions.includes('subscriptionsConfirm') && data.results[0].roles.subscriber.permissions.includes('postsConfirm'))
  test = await netClient.testLocalMethod('readMulti', { ids: ['dashboardTest3'] }, {token: context.tokens.userTest})
  mainTest.testRaw('check roles permissions based on options - 3', test, (data) => !data.errors && !data.results[0].roles.guest.permissions.includes('postsWrite') && !data.results[0].roles.guest.permissions.includes('postsRead') && data.results[0].roles.guest.permissions.includes('subscriptionsConfirm') && data.results[0].roles.subscriber.permissions.includes('postsConfirm'))
  test = await netClient.testLocalMethod('readMulti', { ids: ['dashboardTest4'] }, {token: context.tokens.userTest})
  mainTest.testRaw('check roles permissions based on options - 4', test, (data) => !data.errors && !data.results[0].roles.guest.permissions.includes('postsWrite') && data.results[0].roles.guest.permissions.includes('postsRead') && !data.results[0].roles.guest.permissions.includes('subscriptionsConfirm') && !data.results[0].roles.subscriber.permissions.includes('postsConfirm'))
  await context.destroy()

  mainTest.sectionHead('PIC')
  context = await setContext({
    data: {},
    users: { userTest: {} },
    entities: [
      { id: 'dashboardTest', name: 'name', description: 'description', tags: ['tag1', 'tag2'], roles },
      { id: 'dashboardTest1', name: 'name', description: 'description', tags: ['tag1', 'tag2'], roles }
    ]
  })
  var path = require('path')
  var fs = require('fs')
// mainTest.consoleResume()
  fs.createReadStream(path.join(__dirname, '/test.png')).pipe(fs.createWriteStream(path.join(__dirname, '/test_send.png')))
  test = await netClient.testLocalMethod('addPic', {id: 'dashboardTest', pic: {mimetype: 'image/png', path: path.join(__dirname, '/test_send.png')}}, {token: context.tokens.userTest})
  mainTest.log('test', test)
  // mainTest.consoleResume()
  mainTest.testRaw('addPic', test, (data) => data.success && !data.errors, 1)
  mainTest.testRaw('addPic dbCheck', await dbGet('dashboardTest'), (data) => Object.keys(data.pics).length === 1)

  var picId = test.data.picId
  test = await netClient.testLocalMethod('getPic', {id: picId, size: 'full'}, {token: context.tokens.userTest})
  mainTest.testRaw('getPic', test, (data) => typeof data === 'string')

  test = await netClient.testLocalMethod('deletePic', {id: picId}, {token: context.tokens.userTest})
  mainTest.testRaw('deletePic', test, (data) => data.success && !data.error)
  mainTest.testRaw('deletePic dbCheck on user ', await dbGet(resultId), (data) => Object.keys(data.pics).length === 0)
  mainTest.testRaw('deletePic dbCheck on pic meta', await dbGet(resultId), (data) => Object.keys(data.pics).length === 0)

  test = await netClient.testLocalMethod('getPic', {id: picId, size: 'full'}, {token: context.tokens.userTest})
  mainTest.testRaw('getPic deleted', test, (data) => !data.success && data.error)

  await context.destroy()

  mainTest.sectionHead('DELETE')

  context = await setContext({
    data: {},
    users: { userTest: {}, userTest1: {}, userAdminTest: {permissions: ['dashboardsWrite', 'dashboardsReadAll', 'dashboardsList']} },
    entities: [
      { id: 'dashboardTest', name: 'name', description: 'description', tags: ['tag1', 'tag2'], roles },
      { id: 'dashboardTest1', name: 'name', description: 'description', tags: ['tag1', 'tag2'], roles }
    ]
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions({'permissions': ['dashboardsWrite', 'dashboardsRead']}) }
  })

  test = await netClient.testLocalMethod('deleteMulti', { ids: ['dashboardTest'] }, {token: context.tokens.userTest})
  mainTest.log('test', test)
  mainTest.testRaw('deleteMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('deleteMulti dbCheck', await dbGet('dashboardTest'), (data) => data.deleted === true)

  test = await netClient.testLocalMethod('readMulti', { ids: ['dashboardTest'] }, {token: context.tokens.userTest1})
  mainTest.testRaw('readMulti checkError readMulti Dashboard deleted', test, (data) => data.errors instanceof Array)

  context.updatePuppets({
    subscriptions_listByUserId: () => ({results: [{dashId: 'dashboardTest', roleId: 'admin', id: 'testSubscription'}]})
  })
  test = await netClient.testLocalMethod('readMulti', { ids: ['dashboardTest'] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('readMulti check  Dashboard deleted but readable by admins', test, (data) => !data.errors)

  await context.destroy()

  mainTest.sectionHead('LIST')

  context = await setContext({
    data: {},
    users: { userListTest: {}, userListTest1: {}, userListAdminTest: {permissions: ['dashboardsWrite', 'dashboardsReadAll', 'dashboardsList']} },
    entities: [
      { id: 'dashboardTest', name: 'name', description: 'description', tags: ['tag1', 'tag2'] },
      { id: 'dashboardTest1', name: 'name', description: 'description', tags: ['tag1', 'tag2'] },
      { id: 'dashboardTest2', name: 'name', description: 'description', tags: ['tag1', 'tag2'] }
    ]
    // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  })
  await new Promise((resolve) => setTimeout(resolve, 1000)) // DB INDEX UPDATE
  test = await netClient.testLocalMethod('list', {}, {token: context.tokens.userListAdminTest})
  mainTest.testRaw('list', test, (data) => !data.error && data.results instanceof Array && data.results.length >= 2)

  test = await netClient.testLocalMethod('list', {}, {token: context.tokens.userListTest})
  mainTest.testRaw('list', test, (data) => data.error)

  await context.destroy()

  // mainTest.sectionHead('POST EVENT')
  //
  // context = await setContext({
  //   data: {},
  //   users: { userPostEventTest: {}, userPostEventTest1: {}, userPostEventAdminTest: {permissions: ['dashboardsWrite', 'dashboardsReadAll', 'dashboardsList']} },
  //   entities: []
  //   // testPuppets: { subscriptions_getPermissions: getPuppetSubscriptionsGetPermissions() }
  // })
  // var dashboardsEventCreatePost = await netClient.emit('TEST_POST_EVENT', { view: { body: 'Test Post', id: 'testPostId' }, users: ['userPostEventTest'] }, {token: context.tokens.userPostEventTest})
  // mainTest.log('dashboardsEventCreatePost', dashboardsEventCreatePost)
  // // mainTest.consoleResume()
  // var queryResults = await dbQuery('userId=$1', ['userPostEventTest'])
  // queryResults.forEach((item) => dbRemove(item.id))
  // mainTest.testRaw('postEvent dbCheck', queryResults, (list) => list.length === 1)
  // await context.destroy()

  await new Promise((resolve) => setTimeout(resolve, 1000))
  return mainTest.finish()
}
module.exports = startTest
