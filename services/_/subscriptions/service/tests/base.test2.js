process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'TEST', msg, data])) }
const warn = (msg, data) => { console.log('\n' + JSON.stringify(['WARN', 'TEST', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'TEST', msg, data])) }

var startTest = async function (netClient) {
  async function setContext (contextData) {
    var i
    var tokens = {}
    for (i in contextData.users)tokens[i] = await auth.createToken(i, contextData.users[i].permissions || [], contextData.users[i], CONFIG.jwt)
    for (i in contextData.entities) await DB.put('subscriptionsViews', Object.assign({ id: 'testDash_testUser', meta: {confirmed: true, created: Date.now(), updated: Date.now()}, dashId: 'testDash', roleId: 'subscriber', userId: 'testUser' }, contextData.entities[i]))
    netClient.testPuppets = contextData.testPuppets || {}
    return {
      tokens,
      destroy: async() => {
        for (i in contextData.entities) await DB.remove('subscriptionsViews', contextData.entities[i].id)
      }
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1000))
  var CONFIG = require('../config')
  const auth = require('sint-bit-utils/utils/auth')
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 0)
  var microTest = mainTest.test
  var microTestSection = mainTest.sectionHead
  var microTestRaw = mainTest.testRaw
  var finishTest = mainTest.finish

  const TYPE_OF = (actual, expected) => {
    if (typeof (expected) !== 'object') {
      var type = typeof (actual)
      if (Array.isArray(actual))type = 'array'
      return type
    }
    var filtered = {}
    Object.keys(expected).forEach((key) => { filtered[key] = typeof actual[key] })
    return filtered
  }
  const FILTER_BY_KEYS = (actual, expected) => {
    var filtered = {}
    Object.keys(expected).forEach((key) => { filtered[key] = actual[key] })
    return filtered
  }
  const COUNT = (actual, expected) => actual.length

  var subscriberUser = await auth.createToken('subscriberUser', ['premission'], {test: true}, CONFIG.jwt)
  var adminUser = await auth.createToken('adminUser', ['premission'], {test: true}, CONFIG.jwt)

  netClient.testPuppets.dashboards_info = ({data}) => {
    log('testPuppets dashboards_info', data)
  }

  netClient.testPuppets.dashboards_readMulti = ({data}) => {
    log('testPuppets dashboards_readMulti', data)
    return {
      results: [
        {
          id: 'testDash1',
          roles: {
            guest: puppetGuestRole,
            subscriber: puppetSubscriberRole,
            admin: puppetAdminRole
          }
        }
      ]
    }
  }
  netClient.testPuppets.users_readMulti = (args) => {
    log('testPuppets users_info', args)
    return {
      results: [
        {
          id: 'subscriberUser',
          name: 'Test User 1'
        }
      ]
    }
  }

  var puppetGuestRole = {
    permissions: ['subscriptionsSubscribeWithConfimation', 'subscriptionsRead'],
    public: 1
  }
  var puppetSubscriberRole = {
    public: 1,
    permissions: ['subscriptionsSubscribe', 'subscriptionsSubscribeWithConfimation', 'subscriptionsRead']
  }
  var puppetAdminRole = {
    public: 1,
    permissions: ['subscriptionsSubscribe', 'subscriptionsSubscribeWithConfimation', 'subscriptionsWrite', 'subscriptionsRead']
  }

  const DB = require('sint-bit-utils/utils/dbCouchbaseV2')

  microTestSection('RAW CREATE')

  await DB.remove('subscriptionsViews', 'testDash1_subscriberUser')
  var test = await netClient.testLocalMethod('rawMutateMulti', {
    mutation: 'create',
    items: [{id: undefined, data: { dashId: 'testDash1', userId: 'subscriberUser' }}],
    extend: {
      roleId: 'subscriber',
      tags: ['testTag'],
      notifications: ['email', 'sms', 'fb']
    }
  }, {token: subscriberUser})
  microTestRaw('rawMutateMulti create', test, (data) => data.results instanceof Array && data.results.length === 1)
  var dbCheck = await DB.get('subscriptionsViews', 'testDash1_subscriberUser')
  microTestRaw('rawMutateMulti create dbCheck', dbCheck, (data) => data.roleId === 'subscriber')
  await DB.remove('subscriptionsViews', 'testDash1_subscriberUser')

  microTestSection('CREATE')

  var subscriptions = {
    items: [{ dashId: 'testDash1', userId: 'subscriberUser' }],
    extend: {
      roleId: 'subscriber',
      tags: ['testTag'],
      notifications: ['email', 'sms', 'fb']
    }
  }
  test = await netClient.testLocalMethod('createMulti', subscriptions, {token: subscriberUser})
  microTestRaw('createMulti', test, (data) => data.results instanceof Array && data.results.length === 1)
  dbCheck = await DB.get('subscriptionsViews', 'testDash1_subscriberUser')
  microTestRaw('createMulti dbCheck', dbCheck, (data) => data.roleId === 'subscriber')

  test = await netClient.testLocalMethod('createMulti', subscriptions, {token: subscriberUser})
  microTestRaw('createMulti checkError  Subscription exists', test, (data) => data.errors instanceof Array)
  await DB.remove('subscriptionsViews', 'testDash1_subscriberUser')

  subscriptions.extend.roleId = 'test'
  test = await netClient.testLocalMethod('createMulti', subscriptions, {token: subscriberUser})
  microTestRaw('createMulti checkError  Role not exists or is not active', test, (data) => data.errors instanceof Array)

  puppetAdminRole.public = 0
  subscriptions.extend.roleId = 'admin'
  test = await netClient.testLocalMethod('createMulti', subscriptions, {token: subscriberUser})
  microTestRaw('createMulti checkError  Role is not public', test, (data) => data.errors instanceof Array)

  subscriptions.items[0].userId = 'adminUser'
  test = await netClient.testLocalMethod('createMulti', subscriptions, {token: subscriberUser})
  microTestRaw('createMulti checkError  Can\'t create other users subscriptions', test, (data) => data.errors instanceof Array)

  puppetSubscriberRole.permissions = []
  test = await netClient.testLocalMethod('createMulti', subscriptions, {token: subscriberUser})
  microTestRaw('createMulti checkError  Can\'t subscribe', test, (data) => data.errors instanceof Array)

  subscriptions.extend.roleId = 'subscriber'
  subscriptions.items[0].userId = 'subscriberUser'
  puppetSubscriberRole.permissions = ['subscriptionsSubscribe', 'subscriptionsSubscribeWithConfimation', 'subscriptionsRead']
  await netClient.testLocalMethod('createMulti', subscriptions, {token: subscriberUser})

  subscriptions.extend.roleId = 'admin'
  subscriptions.items[0].userId = 'adminUser'
  await netClient.testLocalMethod('createMulti', subscriptions, {token: adminUser})
  // var resp = await netClient.testLocalMethod('createMulti', subscriptions, {token: subscriberUser})
  // mainTest.consoleResume()
  // console.log('createMultiResp', resp)
  // mainTest.consoleMute()

  microTestSection('READ')

  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash1_subscriberUser'] }, {token: subscriberUser})
  microTestRaw('readMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)

  test = await netClient.testLocalMethod('readMulti', { ids: ['fakeid'] }, {token: subscriberUser})
  microTestRaw('readMulti checkError  Subscription not exists', test, (data) => data.errors instanceof Array)

  microTestSection('UPDATE')

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'testDash1_subscriberUser', tags: ['testUpdate']}] }, {token: subscriberUser})
  microTestRaw('updateMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  dbCheck = await DB.get('subscriptionsViews', 'testDash1_subscriberUser')
  microTestRaw('updateMulti dbCheck', dbCheck, (data) => data.tags[0] === 'testUpdate')

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'fake', tags: ['test']}] }, {token: subscriberUser})
  microTestRaw('updateMulti checkError  Subscription not exists', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'testDash1_adminUser', tags: ['test']}] }, {token: subscriberUser})
  microTestRaw('updateMulti checkError  Cant update other users subscription', test, (data) => data.errors instanceof Array)

  test = await netClient.testLocalMethod('updateMulti', { items: [{id: 'testDash1_subscriberUser', tags: ['test']}] }, {token: adminUser})
  microTestRaw('updateMulti checkError  Admin can update other users subscription', test, (data) => !data.errors)

  microTestSection('DELETE')

  test = await netClient.testLocalMethod('deleteMulti', { ids: ['testDash1_subscriberUser'] }, {token: subscriberUser})
  microTestRaw('deleteMulti', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  dbCheck = await DB.get('subscriptionsViews', 'testDash1_subscriberUser')
  microTestRaw('deleteMulti dbCheck', dbCheck, (data) => data.meta.deleted === true)

  puppetAdminRole.permissions = ['subscriptionsSubscribe', 'subscriptionsSubscribeWithConfimation', 'subscriptionsRead']
  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash1_subscriberUser'] }, {token: adminUser})
  microTestRaw('readMulti checkError Subscription deleted', test, (data) => data.errors instanceof Array)

  puppetSubscriberRole.permissions = ['subscriptionsSubscribe', 'subscriptionsRead']
  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash1_subscriberUser'] }, {token: subscriberUser})
  microTestRaw('readMulti check Subscription deleted but readable by owner', test, (data) => !data.errors)

  puppetAdminRole.permissions = ['subscriptionsRead', 'subscriptionsReadAll']
  test = await netClient.testLocalMethod('readMulti', { ids: ['testDash1_subscriberUser'] }, {token: adminUser})
  microTestRaw('readMulti check  Subscription deleted but readable by admins', test, (data) => !data.errors)

  microTestSection('CONFIRMATIONS')

  puppetSubscriberRole.permissions = ['subscriptionsSubscribeWithConfimation', 'subscriptionsRead']
  await DB.remove('subscriptionsViews', 'testDash1_subscriberUser')
  await netClient.testLocalMethod('createMulti', { items: [{ dashId: 'testDash1', roleId: 'subscriber', userId: 'subscriberUser' }] }, {token: subscriberUser})
  dbCheck = await DB.get('subscriptionsViews', 'testDash1_subscriberUser')
  microTestRaw('createMulti with confirmation', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  microTestRaw('createMulti with confirmation dbCheck', dbCheck, (data) => !data.meta.confirmed)

  puppetAdminRole.permissions = ['subscriptionsSubscribe', 'subscriptionsWrite', 'subscriptionsRead']
  // mainTest.consoleResume()
  await DB.put('subscriptionsViews', { id: 'testDash1_adminUser', meta: {confirmed: true}, dashId: 'testDash1', roleId: 'admin', userId: 'adminUser' })
  test = await netClient.testLocalMethod('confirmMulti', { ids: ['testDash1_subscriberUser'] }, {token: adminUser})
  microTestRaw('confirmMulti by admin user', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  dbCheck = await DB.get('subscriptionsViews', 'testDash1_subscriberUser')
  microTestRaw('confirmMulti dbCheck', dbCheck, (data) => data.meta.confirmed === true)

  microTestSection('TAGS')

  puppetSubscriberRole.permissions = ['subscriptionsSubscribe', 'subscriptionsRead']
  puppetAdminRole.permissions = ['subscriptionsSubscribe', 'subscriptionsWrite', 'subscriptionsRead']
  await DB.put('subscriptionsViews', { id: 'testDash1_subscriberUser', meta: {confirmed: true}, dashId: 'testDash1', roleId: 'subscriber', userId: 'subscriberUser' })
  await DB.put('subscriptionsViews', { id: 'testDash1_adminUser', meta: {confirmed: true}, dashId: 'testDash1', roleId: 'admin', userId: 'adminUser' })
  test = await netClient.testLocalMethod('addTagsMulti', { items: [{id: 'testDash1_subscriberUser', tags: ['tag_by_subscriber', 'tag_by_subscriber2']}] }, {token: subscriberUser})
  microTestRaw('addTagsMulti by subcritpion owner', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  dbCheck = await DB.get('subscriptionsViews', 'testDash1_subscriberUser')
  microTestRaw('addTagsMulti by subcritpion owner dbCheck', dbCheck, (data) => data.tags.indexOf('tag_by_subscriber') > -1)
  test = await netClient.testLocalMethod('addTagsMulti', { items: [{id: 'testDash1_subscriberUser', tags: ['tag_by_admin', 'tag_by_admin2']}] }, {token: adminUser})
  microTestRaw('addTagsMulti by admin', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  dbCheck = await DB.get('subscriptionsViews', 'testDash1_subscriberUser')
  microTestRaw('addTagsMulti by subcritpion owner dbCheck', dbCheck, (data) => data.tags.indexOf('tag_by_admin') > -1)

  microTestSection('LIST BY ROLES AND TAGS')

  puppetSubscriberRole.permissions = ['subscriptionsSubscribe', 'subscriptionsRead']
  puppetAdminRole.permissions = ['subscriptionsSubscribe', 'subscriptionsWrite', 'subscriptionsRead']
  await DB.put('subscriptionsViews', { id: 'testDash1_subscriberUser', meta: {confirmed: true}, dashId: 'testDash1', roleId: 'subscriber', userId: 'subscriberUser', tags: ['tag1', 'tag2'] })
  await DB.put('subscriptionsViews', { id: 'testDash1_adminUser', meta: {confirmed: true}, dashId: 'testDash1', roleId: 'admin', userId: 'adminUser', tags: ['tag1', 'tag3'] })
  test = await netClient.testLocalMethod('listByDashIdTagsRoles', { dashId: 'testDash1', tags: ['tag1'] }, {token: subscriberUser})
  microTestRaw('listByDashIdTagsRoles tags:tag1', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 2)
  test = await netClient.testLocalMethod('listByDashIdTagsRoles', { dashId: 'testDash1', tags: ['tag2'] }, {token: subscriberUser})
  microTestRaw('listByDashIdTagsRoles tags:tag2', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)
  test = await netClient.testLocalMethod('listByDashIdTagsRoles', { dashId: 'testDash1', roles: ['subscriber'] }, {token: subscriberUser})
  microTestRaw('listByDashIdTagsRoles  roles:subscriber ', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 1)

  microTestSection('LIST')

  var context = await setContext({
    users: { userListTest: {} },
    entities: [
      {id: 'testDashListTest_userListTest', userId: 'userListTest', dashId: 'testDashListTest'},
      {id: 'testDashListTest_userListTest2', userId: 'userListTest2', dashId: 'testDashListTest'}
    ],
    testPuppets: {
      dashboards_readMulti: ({data}) => ({ results: [{ id: 'testDashListTest', roles: { guest: puppetGuestRole, subscriber: puppetSubscriberRole, admin: puppetAdminRole } }] })
    }
  })
  await new Promise((resolve) => setTimeout(resolve, 1000)) // DB INDEX UPDATE
  test = await netClient.testLocalMethod('list', { dashId: 'testDashListTest' }, {token: context.tokens.userListTest})
  microTestRaw('list', test, (data) => !data.errors && data.results instanceof Array && data.results.length === 2)
  context.destroy()

  await new Promise((resolve) => setTimeout(resolve, 1000))
  return finishTest()
}
module.exports = startTest
