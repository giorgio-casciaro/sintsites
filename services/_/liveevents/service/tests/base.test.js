process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
const auth = require('sint-bit-utils/utils/auth')

const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'TEST', msg, data])) }
const warn = (msg, data) => { console.log('\n' + JSON.stringify(['WARN', 'TEST', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'TEST', msg, data])) }

process.env.debugMain = true
// process.env.debugCouchbase = false
// process.env.debugJesus = false
// process.env.debugSchema = false

var startTest = async function (netClient, getServiceSchema) {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var CONFIG = require('../config')
  // var microRandom = Math.floor(Math.random() * 100000)
  async function setContext (contextData) {
    var i
    var tokens = {}
    for (i in contextData.users)tokens[i] = await auth.createToken(i, contextData.users[i], CONFIG.jwt)
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
      }
    }
  }
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 0)

  mainTest.sectionHead('SERVICE INFO')
  var context = await setContext({
    users: { userTest: {permissions: ['dashboardsCreate']} },
    testPuppets: {
      subscriptions_listByUserId: () => ({
        results: [
          {
            userId: 'userTest',
            dashId: 'dashTest1',
            tags: ['tag1', 'tag2'],
            roleId: 'admin'
          },
          {
            userId: 'userTest',
            dashId: 'dashTest2',
            tags: ['tag1', 'tag3'],
            roleId: 'subscriber'
          }
        ]
      })
    }
  })
  var eventsStream = await netClient.testLocalMethod('getEvents', {}, {token: context.tokens.userTest})
  // mainTest.consoleResume()
  var streamData = []
  eventsStream.on('data', (data) => { mainTest.log('eventsStream streaming data', data); streamData.push(data) })
  eventsStream.on('error', (data) => { mainTest.log('eventsStream streaming error', data); streamData.push(data) })
  eventsStream.on('end', (data) => { mainTest.log('eventsStream streaming close', data); streamData.push(data) })
  // mainTest.testRaw('SERVICE INFO', eventsStream, (data) => data.schema instanceof Object && data.mutations instanceof Object)
  await netClient.testLocalMethod('triggerEvent', {data: {test: 'test1'}, filters: {dashId: 'dashTest1'}}, {token: context.tokens.userTest})
  await netClient.testLocalMethod('triggerEvent', {data: {test: 'test2'}, filters: {dashId: 'dashTest1', toTags: ['tag1']}}, {token: context.tokens.userTest})
  await netClient.testLocalMethod('triggerEvent', {data: {test: 'test3'}, filters: {dashId: 'dashTest1', toRoles: ['admin']}}, {token: context.tokens.userTest})
  await netClient.testLocalMethod('triggerEvent', {data: {test: 'test1'}, filters: {dashId: 'dashTest3'}}, {token: context.tokens.userTest})
  await netClient.testLocalMethod('triggerEvent', {data: {test: 'test2'}, filters: {dashId: 'dashTest1', toTags: ['tag4']}}, {token: context.tokens.userTest})
  await netClient.testLocalMethod('triggerEvent', {data: {test: 'test3'}, filters: {dashId: 'dashTest1', toRoles: ['fakerole']}}, {token: context.tokens.userTest})
  await new Promise((resolve) => setTimeout(resolve, 1000))
  mainTest.testRaw('getEvents', streamData, (data) => data.length === 3)
  mainTest.log('streamData', streamData)
  await context.destroy()

  // // testLocalMethod (method, data = {}, meta = {}, timeout = false, channel = false) {
  // mainTest.log('PROVA')
  // var eventsStream = await netClient.testLocalMethod('getDashEvents', {dashId: 'testDash', timeout: 10000}, {})
  // mainTest.log('PROVA2')
  // // var eventsStream = netClient.testLocalMethod('getEvents', {timeout: 5000}, {})
  // var streamData = []
  // mainTest.log('PROVA3', eventsStream)
  // eventsStream.on('data', (data) => { mainTest.log('eventsStream streaming data', data); streamData.push(data) })
  // eventsStream.on('error', (data) => { mainTest.log('eventsStream streaming error', data); streamData.push(data) })
  // eventsStream.on('end', (data) => { mainTest.log('eventsStream streaming close', data); streamData.push(data) })
  // mainTest.log('PROVA3')
  //
  // // eventsStream.then((response) => {
  // //   microTest(response, 'string', 'eventsStream', TYPE_OF, 2, {})
  // // })
  // var timestamp = Date.now()
  // await new Promise(function (resolve) { setTimeout(resolve, 500) })
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // var testRemoteEvent_1 = await fakeServiceNetClient.emit('testRemoteEvent', {testRemoteEvent: 1}, {})
  // mainTest.log('PROVA4')
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // var testRemoteEvent_2 = await fakeServiceNetClient.emit('testRemoteEvent', {testRemoteEvent: 2}, {})
  //
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // var testRemoteEvent_3 = await fakeServiceNetClient.emit('testRemoteEvent', {testRemoteEvent: 3}, {})
  //
  // await new Promise(function (resolve) { setTimeout(resolve, 500) })
  // eventsStream.end()
  // microTest(streamData, 3, 'streamData', COUNT)
  //
  // streamData = []
  // eventsStream = await netClient.testLocalMethod('getDashEvents', {dashId: 'testDash', timeout: 10000, fromTimestamp: timestamp}, {})
  // eventsStream.on('data', (data) => { CONSOLE.hl('eventsStream streaming data', data); streamData.push(data) })
  // eventsStream.on('error', (data) => { CONSOLE.hl('eventsStream streaming error', data); streamData.push(data) })
  // eventsStream.on('end', (data) => { CONSOLE.hl('eventsStream streaming close', data); streamData.push(data) })
  //
  // await new Promise(function (resolve) { setTimeout(resolve, 500) })
  // eventsStream.end()
  // microTest(streamData, 3, 'streamData fromTimestamp', COUNT)
  //
  // // microTest(testEvent, [{ test: 'test' }], 'testEvent')
  // microTest(eventsStream, 'object', 'eventsStream', TYPE_OF, -1, {})

  return finishTest()
}
module.exports = startTest
