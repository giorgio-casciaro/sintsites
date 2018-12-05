process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'TEST', msg, data])) }
const warn = (msg, data) => { console.log('\n' + JSON.stringify(['WARN', 'TEST', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'TEST', msg, data])) }

process.env.debugMain = true
process.env.debugCouchbase = false
// process.env.debugJesus = false
// process.env.debugSchema = false

var startTest = async function (netClient) {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var CONFIG = require('../config')
  const auth = require('sint-bit-utils/utils/auth')
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 0)

  function getPuppetSubscriptionsReadMulti (substitutions = {}) {
    var defaultSubscription = Object.assign({
      id: 'testSubscription',
      permissions: ['postsWrite', 'postsRead', 'postsConfirm', 'postsWriteOtherUsers', 'postsReadAll'],
      dashId: 'testDash',
      userId: 'testUser'
    }, substitutions)
    // mainTest.log('getPuppetSubscriptionsReadMulti', {substitutions, defaultSubscription})
    var func = function ({data}) { return { results: [defaultSubscription] } }
    return func
  }

  async function setContext (contextData) {
    var i
    var tokens = {}
    for (i in contextData.users)tokens[i] = await auth.createToken(i, contextData.users[i], CONFIG.jwt)
    for (i in contextData.entities) await DB.put('view', Object.assign({ id: 'testDash_testUser', meta: {confirmed: true, created: Date.now(), updated: Date.now()}, dashId: 'testDash', userId: 'testUser' }, contextData.entities[i]))
    Object.assign(netClient.testPuppets, contextData.testPuppets || {})
    // log('setContext', { keys: Object.keys(netClient.testPuppets), func: netClient.testPuppets.subscriptions_readMulti.toString() })
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

  context = await setContext({
    data: { mutation: 'create', items: [{id: undefined, data: { dashId: 'testDash', userId: 'userTest', body: 'test', tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] }}], extend: { } },
    users: { userTest: {} },
    entities: [],
    testPuppets: { subscriptions_readMulti: getPuppetSubscriptionsReadMulti() }
  })
  test = await netClient.testLocalMethod('rawMutateMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('rawMutateMulti create', test, (data) => data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('rawMutateMulti create dbCheck', await dbGet(test.results[0].id), (data) => data.body === 'test')
  await dbRemove(test.results[0].id)
  await context.destroy()

  mainTest.sectionHead('CREATE')

  context = await setContext({
    data: { items: [{ dashId: 'testDash', userId: 'userTest', body: 'test', tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] }] },
    users: { userTest: {} },
    entities: [],
    testPuppets: { subscriptions_readMulti: getPuppetSubscriptionsReadMulti() }
  })
  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti', test, (data) => data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('createMulti dbCheck', await dbGet(test.results[0].id), (data) => data.body === 'test' && !!data.meta.confirmed)
  await dbRemove(test.results[0].id)

  context.updatePuppets({subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': []})})
  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti checkError No permission to write posts', test, (data) => data.errors instanceof Array)
  await dbRemove(test.results[0].id)

  context.updatePuppets({subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsWrite']})})
  test = await netClient.testLocalMethod('createMulti', context.data, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti with no confimation', test, (data) => data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('createMulti  with no confimation dbCheck', await dbGet(test.results[0].id), (data) => !data.meta.confirmed)
  await dbRemove(test.results[0].id)

  await context.destroy()

  mainTest.sectionHead('READ')

  context = await setContext({
    data: {},
    users: { userTest: {} },
    entities: [
      { id: 'testPost', dashId: 'testDash', userId: 'anotherUserTest', body: 'test', tags: ['testTag'], public: false, toTags: ['testTag'], toRoles: ['testRole'] },
      { id: 'testPost1', dashId: 'testDash', userId: 'anotherUserTest', body: 'test', tags: ['testTag'], public: false, toTags: ['testTag1'], toRoles: ['testRole1'] }
    ],
    testPuppets: { subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsRead'], tags: ['testTag'], roleId: 'testRole'}) }
  })
  test = await netClient.testLocalMethod('readMulti', { ids: ['testPost'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.log('readMulti', test)

  test = await netClient.testLocalMethod('readMulti', { ids: ['fakeid'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti checkError  Post not exists', test, (data) => data.errors instanceof Array)

  context.updatePuppets({subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsRead'], tags: ['testTag1'], roleId: 'testRole1'})})
  test = await netClient.testLocalMethod('readMulti', { ids: ['testPost'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti checkError  Post not readable by user (toTags and roleId)', test, (data) => data.errors instanceof Array)

  context.updatePuppets({subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsRead'], tags: ['testTag1'], roleId: 'testRole'})})
  test = await netClient.testLocalMethod('readMulti', { ids: ['testPost'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti checkError  Post not public but readable toRoles', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)

  context.updatePuppets({subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsRead'], tags: ['testTag'], roleId: 'testRole1'})})
  test = await netClient.testLocalMethod('readMulti', { ids: ['testPost'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti checkError  Post  not public but readable  toTags', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)

  await context.destroy()

  mainTest.sectionHead('UPDATE')

  context = await setContext({
    data: {},
    users: { userTest: {}, userTest1: {} },
    entities: [
      { id: 'testPost', dashId: 'testDash', userId: 'userTest', body: 'test', tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] },
      { id: 'testPost1', dashId: 'testDash', userId: 'userTest1', body: 'test', tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] }
    ],
    testPuppets: { subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsWrite', 'postsRead']}) }
  })

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'testPost', tags: ['testUpdate']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  // dbCheck = await DB.get('postsViews', 'testPost')
  mainTest.testRaw('updateMulti dbCheck', await dbGet('testPost'), (data) => data.tags[0] === 'testUpdate')

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'fake', tags: ['test']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti checkError  Post not exists', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'testPost1', tags: ['test']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('updateMulti checkError  Cant update other users post', test, (data) => data.errors instanceof Array)

  context.updatePuppets({subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsWrite', 'postsRead', 'postsWriteOtherUsers']})})
  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'testPost1', tags: ['test']}] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('updateMulti checkError  postsWrite can update other users post', test, (data) => !data.errors)

  await context.destroy()

  mainTest.sectionHead('DELETE')

  context = await setContext({
    data: {},
    users: { userTest: {} },
    entities: [
      { id: 'testPost', dashId: 'testDash', userId: 'userTest', body: 'test', tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] },
      { id: 'testPost1', meta: {deleted: true}, dashId: 'testDash', userId: 'userTest1', body: 'test', tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] }
    ],
    testPuppets: { subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsWrite', 'postsRead']}) }
  })

  test = await netClient.testLocalMethod('deleteMulti', { ids: ['testPost'] }, {token: context.tokens.userTest})
  // mainTest.log('test', test)
  mainTest.testRaw('deleteMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('deleteMulti dbCheck', await dbGet('testPost'), (data) => data.meta.deleted === true)

  test = await netClient.testLocalMethod('readMulti', { ids: ['testPost1'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti checkError readMulti Post deleted', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('readMulti', { ids: ['testPost'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti check Post deleted but readable by owner', test, (data) => !data.errors)

  context.updatePuppets({subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsWrite', 'postsRead', 'postsReadAll', 'postsWriteOtherUsers']})})
  test = await netClient.testLocalMethod('readMulti', { ids: ['testPost1'] }, {token: context.tokens.userTest})
  mainTest.testRaw('readMulti check  Post deleted but readable by admins', test, (data) => !data.errors)

  await context.destroy()

  mainTest.sectionHead('CONFIRMATIONS')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
    ],
    testPuppets: { subscriptions_readMulti: getPuppetSubscriptionsReadMulti({'permissions': ['postsWrite', 'postsRead']}) }
  })

  test = await netClient.testLocalMethod('createMulti', { items: [{ dashId: 'testDash', userId: 'userTest', body: 'test', tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] }] }, {token: context.tokens.userTest})
  mainTest.testRaw('createMulti with confirmation', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('createMulti with confirmation dbCheck', await dbGet(test.results[0].id), (data) => !data.meta.confirmed)
  var tempId = test.results[0].id
  test = await netClient.testLocalMethod('confirmMulti', { ids: [test.results[0].id] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('confirmMulti by admin user', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('confirmMulti dbCheck', await dbGet(test.results[0].id), (data) => data.meta.confirmed === true)
  await dbRemove(tempId)
  await context.destroy()

  mainTest.sectionHead('TAGS')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
      { id: 'testPost', dashId: 'testDash', userId: 'userTest', body: 'test', tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] },
      { id: 'testPost1', meta: {deleted: true}, dashId: 'testDash', userId: 'userTest1', body: 'test', tags: ['testTag'], toTags: ['testTag'], toRoles: ['subscriber'] }
    ],
    testPuppets: { subscriptions_readMulti: getPuppetSubscriptionsReadMulti() }
  })

  test = await netClient.testLocalMethod('addTagsMulti', { items: [{id: 'testPost', tags: ['tag_by_subscriber', 'tag_by_subscriber2']}] }, {token: context.tokens.userTest})
  mainTest.testRaw('addTagsMulti by subcritpion owner', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('addTagsMulti by subcritpion owner dbCheck', await dbGet('testPost'), (data) => data.tags.indexOf('tag_by_subscriber') > -1)

  test = await netClient.testLocalMethod('addTagsMulti', { items: [{id: 'testPost', tags: ['tag_by_admin', 'tag_by_admin2']}] }, {token: context.tokens.userAdminTest})
  mainTest.testRaw('addTagsMulti by admin', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  mainTest.testRaw('addTagsMulti by admin  dbCheck', await dbGet('testPost'), (data) => data.tags.indexOf('tag_by_admin') > -1)

  await context.destroy()

  mainTest.sectionHead('LIST')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
      { id: 'testPost', public: true, dashId: 'testDash', userId: 'userTest', body: 'test', tags: ['testTag'] },
      { id: 'testPost1', public: true, meta: {deleted: true}, dashId: 'testDash', userId: 'userTest1', body: 'test', tags: ['testTag'] }
    ],
    testPuppets: { subscriptions_readMulti: getPuppetSubscriptionsReadMulti() }
  })
  await new Promise((resolve) => setTimeout(resolve, 1000)) // DB INDEX UPDATE
  test = await netClient.testLocalMethod('list', { dashId: 'testDash' }, {token: context.tokens.userTest})
  mainTest.testRaw('list', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 2)
  await context.destroy()

  mainTest.sectionHead('LIST TO TAGS AND TO ROLES')

  context = await setContext({
    data: {},
    users: { userTest: {}, userAdminTest: {} },
    entities: [
      { id: 'testPost1', meta: {confirmed: true, deleted: false}, public: false, dashId: 'testDash', userId: 'anotherUserTest', body: 'test', tags: ['testTag'], toTags: ['testTag1'], toRoles: ['testRole1'] },
      { id: 'testPost2', meta: {confirmed: true, deleted: false}, public: false, dashId: 'testDash', userId: 'anotherUserTest', body: 'test', tags: ['testTag'], toTags: ['testTag2'], toRoles: ['testRole1'] },
      { id: 'testPost3', meta: {confirmed: true, deleted: false}, public: false, dashId: 'testDash', userId: 'anotherUserTest', body: 'test', tags: ['testTag'], toTags: ['testTag1'], toRoles: ['testRole2'] },
      { id: 'testPost4', meta: {confirmed: true, deleted: false}, public: false, dashId: 'testDash', userId: 'anotherUserTest', body: 'test', tags: ['testTag'], toTags: ['testTag2'], toRoles: ['testRole2'] }
    ],
    testPuppets: { subscriptions_readMulti: getPuppetSubscriptionsReadMulti({permissions: ['postsRead'], roleId: 'testRole1', tags: ['testTag1']}) }
  })
  await new Promise((resolve) => setTimeout(resolve, 1000)) // DB INDEX UPDATE
  test = await netClient.testLocalMethod('list', { dashId: 'testDash' }, {token: context.tokens.userTest})
  mainTest.testRaw('list', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 3)
  await context.destroy()

  await new Promise((resolve) => setTimeout(resolve, 1000))
  return mainTest.finish()
}
module.exports = startTest
