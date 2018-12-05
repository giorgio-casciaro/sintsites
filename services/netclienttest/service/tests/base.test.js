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
  const wait = require('sint-bit-utils/utils/wait')
  await wait.service('http://netclientworkers1/echo', 1000)
  await wait.service('http://netclientworkers2/echo', 1000)

  log('netClient', netClient)
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice communication', 1)
  await new Promise((resolve) => setTimeout(resolve, 5000))
  //
  // mainTest.sectionHead('SERVICE EVENTS')
  // mainTest.consoleResume()
  // await new Promise((resolve) => setTimeout(resolve, 2000))
  //
  // var testEventsRandomDb = {}
  // var eventReceiverBuffer = []
  // var eventReceiverCounter = 0
  // // testEvents.forEach()
  // var eventEmitCounter = 0
  // var eventEmitBuffer = []
  // var eventEmitErrors = []
  // var eventEmitInterval = setInterval(async () => {
  //   eventEmitCounter++
  //   var eventEmitCounterToSend = eventEmitCounter
  //   var testEventsRandom = Math.floor(Math.random() * 1000000)
  //   testEventsRandomDb[testEventsRandom] = true
  //   // log('rpc send start', {eventEmitCounter})
  //   eventEmitBuffer.push(eventEmitCounter)
  //   var test
  //   try { test = await netClient.rpc('civil-microservices_netclientworkers1', 'emitEvent', {type: 'test', data: {random: testEventsRandom, eventEmitCounter}}) } catch (err) {
  //     test = err.message || error
  //     log('rpc error', err)
  //   }
  //   if (!test || !test.success)eventEmitErrors.push({test, eventEmitCounterToSend})
  //   // mainTest.testRaw('SERVICE EMIT EVENT', test, (data) => data.success)
  //   // mainTest.consoleResume()
  // }, 1)
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // var testEvents = await netClient.rpc('civil-microservices_netclientworkers1', 'getEvents', {type: 'test', service: 'test', getQueue: true}, {}, true, true, (stream) => {
  //   log('addedStream', {eventEmitCounter})
  //   stream.on('readable', () => {
  //     var chunk
  //     while ((chunk = stream.read()) !== null) {
  //       eventReceiverCounter++
  //       eventReceiverBuffer.push(chunk.eventEmitCounter)
  //     }
  //   }).on('error', (data) => log('stream error', data)).on('end', (data) => log('stream end', data))
  // }, (stream) => {
  //   log('removeStream', {eventEmitCounter})
  // })
  //
  // // await new Promise((resolve) => setTimeout(resolve, 3000))
  // // log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  //
  // await new Promise((resolve) => setTimeout(resolve, 3000))
  // clearInterval(eventEmitInterval)
  // log('stop sending')
  // await new Promise((resolve) => setTimeout(resolve, 30000))
  // var filtered = eventEmitBuffer.filter(number => eventReceiverBuffer.indexOf(number) < 0)
  // // var filtered2 = eventReceiverBuffer.filter(number => eventEmitBuffer.indexOf(number) < 0)
  // log('eventReceiverBuffer', {filtered, eventEmitErrors})
  // testEvents.destroy()
  // mainTest.testRaw('SERVICE TOTAL EVENTS', {eventEmitCounter, eventReceiverCounter, eventEmitErrors}, (data) => data.eventEmitCounter === data.eventReceiverCounter + eventEmitErrors.length)
  //
  // // ----------------------
  //
  // mainTest.sectionHead('SERVICE PROXY')
  // // mainTest.consoleResume()
  //
  // var testEventsBCounter = 0
  // // var testEventsB = await netClient.rpc('civil-microservices_netclientworkers1', 'getEvents', {type: 'test2', service: 'test2', getQueue: true}, {}, true, true)
  //
  // // var testEventsC = await netClient.rpc('civil-microservices_netclientworkers2', 'getEvents', {type: 'test2', service: 'test2', getQueue: true}, {}, true, true)
  // var eventReceiverBBuffer = []
  // // testEventsB.forEach(stream => stream
  // //   .on('readable', () => {
  // //     var chunk
  // //     while ((chunk = stream.read()) !== null) {
  // //       testEventsBCounter++
  // //       eventReceiverBBuffer.push(chunk.eventCallCounter)
  // //     }
  // //   }).on('error', (data) => log('stream error', data)).on('end', (data) => log('stream end', data)))
  // try {
  //   // log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  //   // log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  //   // log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  //   // log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))
  //   // log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))
  //   // log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))
  // } catch (err) {
  //   log('err', err)
  // }
  // await new Promise((resolve) => setTimeout(resolve, 2000))
  // log('beforetestEventsB')
  //
  // var testEventsB = await netClient.rpc('civil-microservices_netclientworkers1', 'getEvents', {type: 'test2', service: 'test2', getQueue: true}, {}, true, true, (stream) => {
  //   log('addedStream', {testEventsBCounter})
  //   stream.on('readable', () => {
  //     var chunk
  //     while ((chunk = stream.read()) !== null) {
  //       testEventsBCounter++
  //       eventReceiverBBuffer.push(chunk.eventCallCounter)
  //     }
  //   }).on('error', (data) => log('stream error', data)).on('end', (data) => log('stream end', data))
  // }, (stream) => {
  //   log('removeStream', {testEventsBCounter})
  // })
  // log('testEventsB')
  // await new Promise((resolve) => setTimeout(resolve, 2000))
  // var eventCallCounter = 0
  // var eventCallResponsesCounter = 0
  // var eventCallBuffer = []
  // var eventCallErrors = []
  // var eventCallInterval = setInterval(async () => {
  //   eventCallCounter++
  //   var eventCallCounterLoc = eventCallCounter
  //   eventCallBuffer.push(eventCallCounter)
  //   var test
  //   try {
  //     test = await netClient.rpc('civil-microservices_netclientworkers2', 'call', {service: 'civil-microservices_netclientworkers1', method: 'emitEvent', data: {type: 'test2', data: {'test': 'test', eventCallCounter}}})
  //   } catch (err) {
  //     test = err.message || err
  //     // log('rpc error', err)
  //   }
  //   if (!test || !test.success)eventCallErrors.push({test, eventCallCounter: eventCallCounterLoc})
  //   eventCallResponsesCounter++
  //   // log('test', test)
  //   // mainTest.testRaw('SERVICE EMIT EVENT', test, (data) => data.success)
  //   // mainTest.consoleResume()
  //   // var success = false
  //   // while (!success) {
  //   //   var test = await netClient.rpc('civil-microservices_netclientworkers2', 'call', {service: 'civil-microservices_netclientworkers1', method: 'emitEvent', data: {type: 'test2', data: {'test': 'test', eventCallCounter}}})
  //   //   success = test && test.success
  //   // }
  // }, 1)
  // // await new Promise((resolve) => setTimeout(resolve, 1000))
  // // mainTest.consoleResume()
  //
  // await new Promise((resolve) => setTimeout(resolve, 5000))
  // log('before SHOTDOWN', {eventCallCounter})
  // // try { log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {})) } catch (err) { log('err', err) }
  // // await new Promise((resolve) => setTimeout(resolve, 1000))
  // // try { log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {})) } catch (err) { log('err', err) }
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // // try { log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {})) } catch (err) { log('err', err) }
  // // await new Promise((resolve) => setTimeout(resolve, 1000))
  // // try { log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {})) } catch (err) { log('err', err) }
  // log('after SHOTDOWN', {eventCallCounter})
  // await new Promise((resolve) => setTimeout(resolve, 5000))
  // clearInterval(eventCallInterval)
  // log('clearInterval', {eventCallCounter})
  // await new Promise((resolve) => setTimeout(resolve, 30000))
  // var filtered = eventCallBuffer.filter(number => eventReceiverBBuffer.indexOf(number) < 0)
  //
  // log('eventEmitBBuffer', {eventCallCounter, eventCallResponsesCounter, filtered, eventCallErrorsLength: eventCallErrors.length, total: testEventsBCounter + eventCallErrors.length})
  // testEventsB.destroy()
  // mainTest.testRaw('SERVICE PROXY TOTAL EVENTS', {eventCallCounter, testEventsBCounter, eventCallErrors: eventCallErrors.length}, (data) => data.eventCallCounter <= data.testEventsBCounter + data.eventCallErrors)
  //
  // // ----------------------
  //
  // mainTest.sectionHead('SERVICE RPC 1')
  // await new Promise((resolve) => setTimeout(resolve, 5000))
  // // mainTest.consoleResume()
  // var rpcCounter = 0
  // var rpcOkCounter = 0
  // var rpcStartTime = Date.now()
  // var rpcCicles = 10000
  //
  // while (rpcCounter < rpcCicles) {
  //   rpcCounter++
  //   var random = Math.floor(Math.random() * 1000000)
  //   var test
  //   try { test = await netClient.rpc('civil-microservices_netclientworkers1', 'echo', {random}) } catch (err) {
  //     test = err
  //     log('rpc error', err)
  //   }
  //   if (test && test.random === random)rpcOkCounter++
  // }
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // log('osInfo', await netClient.rpc('civil-microservices_netclientworkers1', 'osInfo', {}))
  // mainTest.testRaw('SERVICE RPC', {rpcCounter, rpcOkCounter, Seconds: (Date.now() - rpcStartTime) / 1000, millisecondsPerRequest: (Date.now() - rpcStartTime) / rpcCicles}, (data) => data.rpcCounter === data.rpcOkCounter)

  mainTest.sectionHead('SERVICE RPC 2')
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
    log('test', {test,random})
    if (test && test.random === random)rpcOkCounter++
  }
  await new Promise((resolve) => setTimeout(resolve, 10000))
  log('osInfo', await netClient.rpc('civil-microservices_netclientworkers1', 'osInfo', {}))
  mainTest.testRaw('SERVICE RPC', {rpcCounter, rpcOkCounter, Seconds: (Date.now() - rpcStartTime) / 1000, millisecondsPerRequest: (Date.now() - rpcStartTime) / rpcCicles}, (data) => data.rpcCounter === data.rpcOkCounter)

  // ----------------------

  mainTest.sectionHead('SERVICE RPC NO AWAIT')
  // mainTest.consoleResume()
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
    log('test', {test,random})
    if (test && test.random === random)rpcOkCounter++
  }
  mainTest.testRaw('SERVICE RPC', {rpcCounter, rpcOkCounter, Seconds: (Date.now() - rpcStartTime) / 1000, millisecondsPerRequest: (Date.now() - rpcStartTime) / rpcCicles}, (data) => data.rpcCounter === data.rpcOkCounter)

  // ----------------------

  var testEventsCCounter = 0
  await new Promise((resolve) => setTimeout(resolve, 30000))
  mainTest.sectionHead('SERVICE LONG RPC ')
  mainTest.consoleResume()
  var testEventsC = await netClient.rpc('civil-microservices_netclientworkers1', 'getEvents', {type: 'testLongRpc', service: 'testLongRpc', getQueue: true}, {}, true, true, (stream) => {
    log('addedStream', {testEventsCCounter})
    stream.on('readable', () => {
      while ((stream.read()) !== null) {
        testEventsCCounter++
      }
    }).on('error', (data) => log('stream error', data)).on('end', (data) => log('stream end', data))
  }, (stream) => {
    log('removeStream', {testEventsCCounter})
  })
  await new Promise((resolve) => setTimeout(resolve, 2000))

  log('osInfo', await netClient.rpc('civil-microservices_netclientworkers1', 'osInfo', {}))
  var countLongRpc = 0
  var longRpc = async () => {
    testEventsCCounter = 0
    countLongRpc++
    mainTest.sectionHead('SERVICE LONG RPC ' + countLongRpc)
    mainTest.consoleResume()

    var rpcCounter = 0
    var rpcOkCounter = 0
    var rpcStartTime = Date.now()
    var rpcCicles = 1000
    while (rpcCounter < rpcCicles) {
      rpcCounter++
      try {
        var test = await netClient.rpc('civil-microservices_netclientworkers2', 'call', {service: 'civil-microservices_netclientworkers1', method: 'emitEvent', data: {type: 'testLongRpc', data: {'test': 'test'}}})
        if (test && test.success)rpcOkCounter++
      } catch (err) {
        log('rpc error', err)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000))
    log('osInfo', await netClient.rpc('civil-microservices_netclientworkers1', 'osInfo', {}))
    log('osInfo', await netClient.rpc('civil-microservices_netclientworkers2', 'osInfo', {}))
    mainTest.testRaw('SERVICE LONG RPC', {rpcCounter, rpcOkCounter, testEventsCCounter, Seconds: (Date.now() - rpcStartTime) / 1000, millisecondsPerRequest: (Date.now() - rpcStartTime) / rpcCicles}, (data) => data.rpcOkCounter === data.testEventsCCounter)
    // try { log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers?', await netClient.rpc('civil-microservices_netclientworkers' + Math.floor(Math.random() + 1), 'shutdown', {})) } catch (err) { log('err', err) }
    await new Promise((resolve) => setTimeout(resolve, 15000))
  }
  while (countLongRpc < 1000) await longRpc()
  return mainTest.finish()
}
module.exports = startTest
