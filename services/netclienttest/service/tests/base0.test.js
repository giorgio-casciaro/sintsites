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
  log('netClient', netClient)
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice communication', 1)
  await new Promise((resolve) => setTimeout(resolve, 5000))

  mainTest.sectionHead('SERVICE RPC')
  mainTest.consoleResume()
  var rpcCounter = 0
  var rpcOkCounter = 0
  var rpcInterval = setInterval(async () => {
    rpcCounter++
    var random = Math.floor(Math.random() * 1000000)
    var test
    try { test = await netClient.rpc('civil-microservices_netclientworkers1', 'echo', {random}) } catch (err) {
      test = err
      log('rpc error', err)
    }
      // mainTest.testRaw('SERVICE RPC', test, (data) => data.random === random)
      // mainTest.consoleResume()
    if (test && test.random === random)rpcOkCounter++
  }, 1)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  clearInterval(rpcInterval)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  mainTest.testRaw('SERVICE RPC', {rpcCounter, rpcOkCounter}, (data) => data.rpcCounter === data.rpcOkCounter)

  mainTest.sectionHead('SERVICE EVENTS')
  mainTest.consoleResume()
  await new Promise((resolve) => setTimeout(resolve, 2000))

  var testEventsRandomDb = {}
  var eventReceiverBuffer = []
  var eventReceiverCounter = 0
  // testEvents.forEach()
  var eventEmitCounter = 0
  var eventEmitBuffer = []
  var eventEmitErrors = []
  var eventEmitInterval = setInterval(async () => {
    eventEmitCounter++
    var eventEmitCounterToSend = eventEmitCounter
    var testEventsRandom = Math.floor(Math.random() * 1000000)
    testEventsRandomDb[testEventsRandom] = true
    // log('rpc send start', {eventEmitCounter})
    eventEmitBuffer.push(eventEmitCounter)
    var test
    try { test = await netClient.rpc('civil-microservices_netclientworkers1', 'emitEvent', {type: 'test', data: {random: testEventsRandom, eventEmitCounter}}) } catch (err) {
      test = err.message || error
      log('rpc error', err)
    }
    if (!test || !test.success)eventEmitErrors.push({test, eventEmitCounterToSend})
    // mainTest.testRaw('SERVICE EMIT EVENT', test, (data) => data.success)
    // mainTest.consoleResume()
  }, 1)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var testEvents = await netClient.rpc('civil-microservices_netclientworkers1', 'getEvents', {type: 'test', service: 'test'}, {}, true, true, (stream) => {
    log('addedStream', {eventEmitCounter})
    stream.on('readable', () => {
      var chunk
      while ((chunk = stream.read()) !== null) {
        eventReceiverCounter++
        eventReceiverBuffer.push(chunk.eventEmitCounter)
      }
    }).on('error', (data) => log('stream error', data)).on('end', (data) => log('stream end', data))
  }, (stream) => {
    log('removeStream', {eventEmitCounter})
  })

  await new Promise((resolve) => setTimeout(resolve, 3000))
  mainTest.consoleResume()
  try {
    log('before SHOTDOWN', {eventEmitCounter})
    log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
    log('after SHOTDOWN', {eventEmitCounter})
  } catch (error) {
    log('rpc error', error)
  }
  await new Promise((resolve) => setTimeout(resolve, 3000))
  clearInterval(eventEmitInterval)
  log('stop sending')
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var filtered = eventEmitBuffer.filter(number => eventReceiverBuffer.indexOf(number) < 0)
  // var filtered2 = eventReceiverBuffer.filter(number => eventEmitBuffer.indexOf(number) < 0)
  log('eventReceiverBuffer', {filtered, eventEmitErrors})
  testEvents.destroy()
  mainTest.testRaw('SERVICE TOTAL EVENTS', {eventEmitCounter, eventReceiverCounter, eventEmitErrors}, (data) => data.eventEmitCounter === data.eventReceiverCounter + eventEmitErrors.length)
  mainTest.consoleResume()

  mainTest.sectionHead('SERVICE PROXY')
  mainTest.consoleResume()

  var testEventsBCounter = 0
  // var testEventsB = await netClient.rpc('civil-microservices_netclientworkers1', 'getEvents', {type: 'test2', service: 'test2'}, {}, true, true)

  // var testEventsC = await netClient.rpc('civil-microservices_netclientworkers2', 'getEvents', {type: 'test2', service: 'test2'}, {}, true, true)
  var eventReceiverBBuffer = []
  // testEventsB.forEach(stream => stream
  //   .on('readable', () => {
  //     var chunk
  //     while ((chunk = stream.read()) !== null) {
  //       testEventsBCounter++
  //       eventReceiverBBuffer.push(chunk.eventCallCounter)
  //     }
  //   }).on('error', (data) => log('stream error', data)).on('end', (data) => log('stream end', data)))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))

  await new Promise((resolve) => setTimeout(resolve, 2000))

  var testEventsB = await netClient.rpc('civil-microservices_netclientworkers1', 'getEvents', {type: 'test2', service: 'test2'}, {}, true, true, (stream) => {
    // log('addedStream', {testEventsBCounter, stream})
    stream.on('readable', () => {
      var chunk
      while ((chunk = stream.read()) !== null) {
        testEventsBCounter++
        eventReceiverBBuffer.push(chunk.eventCallCounter)
      }
    }).on('error', (data) => log('stream error', data)).on('end', (data) => log('stream end', data))
  }, (stream) => {
    log('removeStream', {testEventsBCounter, stream})
  })
  await new Promise((resolve) => setTimeout(resolve, 2000))
  var eventCallCounter = 0
  var eventCallResponsesCounter = 0
  var eventCallBuffer = []
  var eventCallErrors = []
  var eventCallInterval = setInterval(async () => {
    eventCallCounter++
    var eventCallCounterLoc = eventCallCounter
    eventCallBuffer.push(eventEmitCounter)
    var test
    try {
      test = await netClient.rpc('civil-microservices_netclientworkers2', 'call', {service: 'civil-microservices_netclientworkers1', method: 'emitEvent', data: {type: 'test2', data: {'test': 'test', eventCallCounter}}})
    } catch (err) {
      test = err.message || err
      log('rpc error', err)
    }
    if (!test || !test.success)eventCallErrors.push({test, eventCallCounter: eventCallCounterLoc})
    eventCallResponsesCounter++
    // log('test', test)
    // mainTest.testRaw('SERVICE EMIT EVENT', test, (data) => data.success)
    // mainTest.consoleResume()
    // var success = false
    // while (!success) {
    //   var test = await netClient.rpc('civil-microservices_netclientworkers2', 'call', {service: 'civil-microservices_netclientworkers1', method: 'emitEvent', data: {type: 'test2', data: {'test': 'test', eventCallCounter}}})
    //   success = test && test.success
    // }
  }, 1)
  // await new Promise((resolve) => setTimeout(resolve, 1000))

  await new Promise((resolve) => setTimeout(resolve, 5000))
  log('before SHOTDOWN', {eventCallCounter})
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  await new Promise((resolve) => setTimeout(resolve, 1000))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  await new Promise((resolve) => setTimeout(resolve, 1000))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))
  await new Promise((resolve) => setTimeout(resolve, 1000))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))
  log('after SHOTDOWN', {eventCallCounter})
  await new Promise((resolve) => setTimeout(resolve, 5000))
  clearInterval(eventCallInterval)
  await new Promise((resolve) => setTimeout(resolve, 5000))
  mainTest.consoleResume()
  var filtered = eventCallBuffer.filter(number => eventReceiverBBuffer.indexOf(number) < 0)

  log('eventEmitBBuffer', {eventCallCounter, eventCallResponsesCounter, filtered, eventCallErrorsLength: eventCallErrors.length, total: testEventsBCounter + eventCallErrors.length})
  testEventsB.destroy()
  mainTest.testRaw('SERVICE PROXY TOTAL EVENTS', {eventCallCounter, testEventsBCounter, eventCallErrors}, (data) => data.eventCallCounter <= data.testEventsBCounter + data.eventCallErrors.length)

  mainTest.sectionHead('SERVICE RPC')
  mainTest.consoleResume()
  var rpcCounter = 0
  var rpcOkCounter = 0
  var rpcStartTime = Date.now()
  var rpcCicles = 10000

  while (rpcCounter < rpcCicles) {
    rpcCounter++
    var random = Math.floor(Math.random() * 1000000)
    var test
    try { test = await netClient.rpc('civil-microservices_netclientworkers1', 'echo', {random}) } catch (err) {
      test = err
      log('rpc error', err)
    }
      // mainTest.testRaw('SERVICE RPC', test, (data) => data.random === random)
      // mainTest.consoleResume()
    if (test && test.random === random)rpcOkCounter++
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
  mainTest.testRaw('SERVICE RPC', {rpcCounter, rpcOkCounter, Seconds: (Date.now() - rpcStartTime) / 1000, millisecondsPerRequest: (Date.now() - rpcStartTime) / rpcCicles}, (data) => data.rpcCounter === data.rpcOkCounter)

  mainTest.sectionHead('SERVICE RPC')
  mainTest.consoleResume()
  var rpcCounter = 0
  var rpcOkCounter = 0
  var rpcStartTime = Date.now()
  var rpcCicles = 10000

  while (rpcCounter < rpcCicles) {
    rpcCounter++
    var random = Math.floor(Math.random() * 1000000)
    var test
    try { test = await netClient.rpc('civil-microservices_netclientworkers1', 'echo', {random}) } catch (err) {
      test = err
      log('rpc error', err)
    }
      // mainTest.testRaw('SERVICE RPC', test, (data) => data.random === random)
      // mainTest.consoleResume()
    if (test && test.random === random)rpcOkCounter++
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
  mainTest.testRaw('SERVICE RPC', {rpcCounter, rpcOkCounter, Seconds: (Date.now() - rpcStartTime) / 1000, millisecondsPerRequest: (Date.now() - rpcStartTime) / rpcCicles}, (data) => data.rpcCounter === data.rpcOkCounter)

  mainTest.sectionHead('SERVICE RPC NO AWAIT')
  mainTest.consoleResume()
  var rpcCounter = 0
  var rpcOkCounter = 0
  var rpcStartTime = Date.now()
  var rpcCicles = 1000

  while (rpcCounter < rpcCicles) {
    rpcCounter++
    netClient.rpc('civil-microservices_netclientworkers1', 'echo', {}).then(test => { if (test)rpcOkCounter++ })
    // try { test = await netClient.rpc('civil-microservices_netclientworkers1', 'echo', {random}) } catch (err) {
    //   test = err
    //   log('rpc error', err)
    // }
    //   // mainTest.testRaw('SERVICE RPC', test, (data) => data.random === random)
    //   // mainTest.consoleResume()
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
  mainTest.testRaw('SERVICE RPC', {rpcCounter, rpcOkCounter, Seconds: (Date.now() - rpcStartTime) / 1000, millisecondsPerRequest: (Date.now() - rpcStartTime) / rpcCicles}, (data) => data.rpcCounter === data.rpcOkCounter)

  mainTest.sectionHead('SERVICE LONG RPC')
  mainTest.consoleResume()
  var rpcCounter = 0
  var rpcOkCounter = 0
  var rpcStartTime = Date.now()
  var rpcCicles = 100000
  // log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  // await new Promise((resolve) => setTimeout(resolve, 1000))

  while (rpcCounter < rpcCicles) {
    rpcCounter++
    var random = Math.floor(Math.random() * 1000000)
    var test
    try { test = await netClient.rpc('civil-microservices_netclientworkers1', 'echo', {random}) } catch (err) {
      test = err
      log('rpc error', err)
    }
      // mainTest.testRaw('SERVICE RPC', test, (data) => data.random === random)
      // mainTest.consoleResume()
    if (test && test.random === random)rpcOkCounter++
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
  mainTest.testRaw('SERVICE RPC', {rpcCounter, rpcOkCounter, Seconds: (Date.now() - rpcStartTime) / 1000, millisecondsPerRequest: (Date.now() - rpcStartTime) / rpcCicles}, (data) => data.rpcCounter === data.rpcOkCounter)

  return mainTest.finish()
}
module.exports = startTest
