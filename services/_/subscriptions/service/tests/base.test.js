process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'TEST', msg, data])) }
const warn = (msg, data) => { console.log('\n' + JSON.stringify(['WARN', 'TEST', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'TEST', msg, data])) }

process.env.debugMain = false
process.env.debugCouchbase = false
process.env.debugMain = false
process.env.debugCouchbase = false

var startTest = async function (netClient) {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var CONFIG = require('../config')
  const auth = require('sint-bit-utils/utils/auth')
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 0)
  function getPuppetDashboard (substitutions) {
    var defaultDashboard = {
      id: 'testDash',
      roles: {
        guest: { public: 1, permissions: ['subscriptionsSubscribeWithConfimation', 'subscriptionsRead'] },
        subscriber: { public: 1, permissions: [ 'subscriptionsRead' ] },
        admin: { public: 0, permissions: [ 'subscriptionsWrite', 'subscriptionsRead', 'subscriptionsReadAll' ] }
      }
    }
    var func = function ({data}) { return { results: [defaultDashboard] } }
    return func
  }
  async function setContext (contextData) {
    var i
    var tokens = {}
    for (i in contextData.users)tokens[i] = await auth.createToken(i, contextData.users[i], CONFIG.jwt)
    for (i in contextData.entities) await DB.put('view', Object.assign({ id: 'testDash_testUser', META_VIEW: { created: Date.now(), updated: Date.now()}, confirmed: true, deleted: false, dashId: 'testDash', roleId: 'subscriber', userId: 'testUser' }, contextData.entities[i]))
    Object.assign(netClient.testPuppets, contextData.testPuppets || {})
    // log('setContext', { keys: Object.keys(netClient.testPuppets), func: netClient.testPuppets.dashboards_readMulti.toString() })
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
  var context = await setContext({users: { userTest: {} }})
  var test = await netClient.testLocalMethod('serviceInfo', {}, {token: context.tokens.userTest})
  mainTest.testRaw('SERVICE INFO', test, (data) => data.schema instanceof Object && data.mutations instanceof Object)
  await context.destroy()

  mainTest.sectionHead('RAW CREATE')
  // mainTest.consoleResume()

  context = await setContext({
    data: { mutation: 'create', items: [{id: undefined, data: { dashId: 'testDash', userId: 'userTest', roleId: 'subscriber', tags: ['testTag'], notifications: ['email', 'sms', 'fb'] }}], extend: { } },
    users: { userTest: {} },
    entities: [],
    testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  })
  test = await netClient.testLocalMethod('rawMutateMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('rawMutateMulti create', test, (data) => data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('rawMutateMulti create dbCheck', await dbGet('testDash_userTest'), (data) => data.roleId === 'subscriber')
  await dbRemove('testDash_userTest')
  await context.destroy()

  mainTest.sectionHead('CREATE')

  context = await setContext({
    data: { items: [{ dashId: 'testDash', userId: 'userTest', roleId: 'subscriber', tags: ['testTag'], notifications: ['email', 'sms', 'fb'] }] },
    users: { userTest: {} },
    entities: [],
    testPuppets: { dashboards_readMulti: getPuppetDashboard({'roles/admin/public': 1}) }
  })
  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti', test, (data) => data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('createMulti dbCheck', await dbGet('testDash_userTest'), (data) => data.roleId === 'subscriber')

  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti checkError  Subscription exists', test, (data) => data.errors instanceof Array)
  await dbRemove('testDash_userTest')

  context.data.items[0].roleId = 'test'
  mainTest.log('context.data', context.data)
  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti checkError  Role not exists or is not active', test, (data) => data.errors instanceof Array)

  context.data.items[0].roleId = 'admin'
  context.updatePuppets({'dashboards_readMulti': getPuppetDashboard({'roles/admin/public': 0})})

  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti checkError  Role is not public', test, (data) => data.errors instanceof Array)

  context.data.items[0].userId = 'userAdminTest'
  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti checkError  Can\'t create other users subscriptions', test, (data) => data.errors instanceof Array)

  context.data.items[0].roleId = 'test'
  context.updatePuppets({'dashboards_readMulti': getPuppetDashboard({'roles/subscriber/permissions': []})})

  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti checkError  Can\'t subscribe', test, (data) => data.errors instanceof Array)

  await context.destroy()

  mainTest.sectionHead('READ')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
      {id: 'testDash_userTest', userId: 'userTest', dashId: 'testDash'},
      {id: 'testDash_userAdminTest', userId: 'userAdminTest', dashId: 'testDash'}
    ],
    testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  })
  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash_userTest'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)

  test = await netClient.testLocalMethod('readMulti', { ids: ['fakeid'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti checkError  Subscription not exists', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash_userTest'], linkedViews: ['permissions'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti', test, (data) => !data.errors && data.results instanceof Array && data.results[0].permissions instanceof Array)
  mainTest.log('data.results[0].permissions ', test.results[0].permissions)

  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash_userTest'], linkedViews: ['role'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti', test, (data) => !data.errors && data.results instanceof Array && data.results[0].role)
  mainTest.log('data.results[0].role ', test.results[0].role)

  await context.destroy()

  mainTest.sectionHead('UPDATE')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
        {id: 'testDash_userTest', userId: 'userTest', dashId: 'testDash', roleId: 'subscriber'},
        {id: 'testDash_userAdminTest', userId: 'userAdminTest', dashId: 'testDash', roleId: 'admin'}
    ],
    testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  })

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'testDash_userTest', tags: ['testUpdate']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  // dbCheck = await DB.get('subscriptionsViews', 'testDash_userTest')
  mainTest.testRaw('updateMulti dbCheck', await dbGet('testDash_userTest'), (data) => data.tags[0] === 'testUpdate')

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'fake', tags: ['test']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti checkError  Subscription not exists', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'testDash_userAdminTest', tags: ['test']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti checkError  Cant update other users subscription', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'testDash_userTest', tags: ['test']}] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('updateMulti checkError  Admin can update other users subscription', test, (data) => !data.errors)

  await context.destroy()

  mainTest.sectionHead('DELETE')

  context = await setContext({
    data: {},
    users: { userTest: {}, userTest2: {}, userAdminTest: {} },
    entities: [
      {id: 'testDash_userTest', userId: 'userTest', dashId: 'testDash', roleId: 'subscriber'},
      {id: 'testDash_userTest2', userId: 'userTest2', dashId: 'testDash', roleId: 'subscriber'},
      {id: 'testDash_userAdminTest', userId: 'userAdminTest', dashId: 'testDash', roleId: 'admin'}
    ],
    testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  })

  test = await netClient.testLocalMethod('deleteMulti', { ids: ['testDash_userTest'] }, {token: context.tokens.userTest})
  mainTest.testRaw('deleteMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('deleteMulti dbCheck', await dbGet('testDash_userTest'), (data) => data.deleted === true)

  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash_userTest'] }, {token: context.tokens.userTest2})
  mainTest.testRaw('readMulti checkError Subscription deleted', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash_userTest'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti check Subscription deleted but readable by owner', test, (data) => !data.errors)

  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash_userTest'] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('readMulti check  Subscription deleted but readable by admins', test, (data) => !data.errors)

  await context.destroy()

  mainTest.sectionHead('CONFIRMATIONS')

  // context = await setContext({
  //   data: {},
  //   users: { userTest: {}, userAdminTest: {} },
  //   entities: [
  //     {id: 'testDash_userTest', userId: 'userTest', dashId: 'testDash', roleId: 'subscriber'},
  //     {id: 'testDash_userTest2', userId: 'userTest2', dashId: 'testDash', roleId: 'subscriber'},
  //     {id: 'testDash_userAdminTest', userId: 'userAdminTest', dashId: 'testDash', roleId: 'admin'}
  //   ],
  //   testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  // })
  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [{id: 'testDash_userAdminTest', userId: 'userAdminTest', dashId: 'testDash', roleId: 'admin'}],
    testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  })

  test = await netClient.testLocalMethod('createMulti', { items: [{ dashId: 'testDash', roleId: 'subscriber', userId: 'userTest' }] }, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti with confirmation', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('createMulti with confirmation dbCheck', await dbGet('testDash_userTest'), (data) => !data.confirmed)

  test = await netClient.testLocalMethod('confirmMulti', { ids: ['testDash_userTest'] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('confirmMulti by admin user', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('confirmMulti dbCheck', await dbGet('testDash_userTest'), (data) => data.confirmed === true)
  await context.destroy()

  mainTest.sectionHead('TAGS')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
          {id: 'testDash_userTest', userId: 'userTest', dashId: 'testDash', roleId: 'subscriber'},
          {id: 'testDash_userAdminTest', userId: 'userAdminTest', dashId: 'testDash', roleId: 'admin'}
    ],
    testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  })

  test = await netClient.testLocalMethod('addTagsMulti', { items: [{id: 'testDash_userTest', tags: ['tag_by_subscriber', 'tag_by_subscriber2']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('addTagsMulti by subcritpion owner', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('addTagsMulti by subcritpion owner dbCheck', await dbGet('testDash_userTest'), (data) => data.tags.indexOf('tag_by_subscriber') > -1)

  test = await netClient.testLocalMethod('addTagsMulti', { items: [{id: 'testDash_userTest', tags: ['tag_by_admin', 'tag_by_admin2']}] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('addTagsMulti by admin', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('addTagsMulti by admin  dbCheck', await dbGet('testDash_userTest'), (data) => data.tags.indexOf('tag_by_admin') > -1)

  await context.destroy()

  mainTest.sectionHead('LIST BY ROLES AND TAGS')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
          {id: 'testDash_userTest', userId: 'userTest', dashId: 'testDash', roleId: 'subscriber', tags: ['tag1']},
          {id: 'testDash_userAdminTest', userId: 'userAdminTest', dashId: 'testDash', roleId: 'admin', tags: ['tag1', 'tag2']}
    ],
    testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  })
  await new Promise((resolve) => setTimeout(resolve, 1000)) // DB INDEX UPDATE

  test = await netClient.testLocalMethod('listByDashIdTagsRoles', { dashId: 'testDash', tags: ['tag1'] }, {token: context.tokens.userTest})
  mainTest.testRaw('listByDashIdTagsRoles tags:tag1', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 2)
  test = await netClient.testLocalMethod('listByDashIdTagsRoles', { dashId: 'testDash', tags: ['tag2'] }, {token: context.tokens.userTest})
  mainTest.testRaw('listByDashIdTagsRoles tags:tag2', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  test = await netClient.testLocalMethod('listByDashIdTagsRoles', { dashId: 'testDash', roles: ['subscriber'] }, {token: context.tokens.userTest})
  mainTest.testRaw('listByDashIdTagsRoles  roles:subscriber ', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)

  await context.destroy()

  mainTest.sectionHead('LIST BY USER')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
      {id: 'testDash_userTest1', userId: 'userTest', dashId: 'testDash', roleId: 'subscriber', tags: ['tag1']},
      {id: 'testDash_userTest2', userId: 'userTest', dashId: 'testDash', roleId: 'admin', tags: ['tag1', 'tag2']},
      {id: 'testDash_userTest3', userId: 'userTest', dashId: 'testDash', roleId: 'subscriber', tags: ['tag1']},
      {id: 'testDash_userTest4', userId: 'userTest', dashId: 'testDash', roleId: 'admin', tags: ['tag1', 'tag2']}
    ],
    testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  })
  await new Promise((resolve) => setTimeout(resolve, 1000)) // DB INDEX UPDATE

  test = await netClient.testLocalMethod('listByUserId', { userId: 'userTest' }, {token: context.tokens.userTest})
  mainTest.testRaw('LIST BY USER', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 4)

  await context.destroy()

  mainTest.sectionHead('LIST')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
          {id: 'testDash_userTest', userId: 'userTest', dashId: 'testDash', roleId: 'subscriber'},
          {id: 'testDash_userAdminTest', userId: 'userAdminTest', dashId: 'testDash', roleId: 'admin'}
    ],
    testPuppets: { dashboards_readMulti: getPuppetDashboard() }
  })
  await new Promise((resolve) => setTimeout(resolve, 1000)) // DB INDEX UPDATE
  test = await netClient.testLocalMethod('list', { dashId: 'testDash' }, {token: context.tokens.userTest})
  mainTest.testRaw('list', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 2)
  await context.destroy()

  await new Promise((resolve) => setTimeout(resolve, 1000))
  return mainTest.finish()
}
module.exports = startTest
