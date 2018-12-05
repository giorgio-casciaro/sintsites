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
  var microRandom = Math.floor(Math.random() * 100000)
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // mainTest.sectionHead('SERVICE STREAM')
  // mainTest.consoleResume()
  // log('civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  // log('civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  // log('civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  // await new Promise((resolve) => setTimeout(resolve, 60000 * 5))

  // mainTest.sectionHead('SERVICE STREAM')
  // mainTest.consoleResume()
  // //   write <Function> Implementation for the stream._write() method.
  // // writev <Function> Implementation for the stream._writev() method.
  // // destroy <Function> Implementation for the stream._destroy() method.
  // // final <Function> Implementation for the stream._final() method.
  // var externalMessagesBuffer = []
  // class TestStream extends require('stream').Duplex {
  //   _write (chunk, encoding, callback) {
  //     log('_write', {chunk, encoding, callback})
  //     try {
  //       // WRITE STREAM TO RESOURCE
  //       callback()
  //     } catch (err) {
  //       callback(new Error('chunk is invalid'))
  //     }
  //   }
  //   _destroy (err, callback) {
  //     log('_destroy', {err, callback})
  //   }
  //   _final (err, callback) {
  //     log('_final', {err, callback})
  //   }
  //   _read (size) {
  //     // READ STREAM FROM RESOURCE
  //     if (externalMessagesBuffer[0]) this.push(externalMessagesBuffer.shift())
  //     log('_read', {size})
  //   }
  // }
  // var stream = new TestStream({writableObjectMode: true, readableObjectMode: true})
  // stream.on('error', (error) => { log('stream error', {error, errormsg: error.message}) })
  // stream.on('data', (data) => { log('stream data', {data}) })
  // stream.write('test write')
  // externalMessagesBuffer.push('response')
  // log('read', stream.read('test read'))

  mainTest.sectionHead('SERVICE RPC')
  mainTest.consoleResume()
  var rpcCounter = 0
  var rpcOkCounter = 0
  var rpcInterval = setInterval(async () => {
    rpcCounter++
    var random = Math.floor(Math.random() * 1000000)
    var test = await netClient.rpc('civil-microservices_netclientworkers1', 'echo', {random})
      // mainTest.testRaw('SERVICE RPC', test, (data) => data.random === random)
      // mainTest.consoleResume()
    if (test.random === random)rpcOkCounter++
  }, 1)
  await new Promise((resolve) => setTimeout(resolve, 5000))
  clearInterval(rpcInterval)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  mainTest.testRaw('SERVICE RPC', {rpcCounter, rpcOkCounter}, (data) => data.rpcCounter === data.rpcOkCounter)
  //
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
    var testEventsRandom = Math.floor(Math.random() * 1000000)
    testEventsRandomDb[testEventsRandom] = true
    // log('rpc send start', {eventEmitCounter})
    eventEmitBuffer.push(eventEmitCounter)
    var test = await netClient.rpc('civil-microservices_netclientworkers1', 'emitEvent', {type: 'test', data: {random: testEventsRandom, eventEmitCounter}})
    if (!test || !test.success)eventEmitErrors.push({test, eventEmitCounter})
    // mainTest.testRaw('SERVICE EMIT EVENT', test, (data) => data.success)
    // mainTest.consoleResume()
  }, 1)
  // var eventEmitInterval2 = setInterval(async () => {
  //   eventEmitCounter++
  //   var testEventsRandom = Math.floor(Math.random() * 1000000)
  //   testEventsRandomDb[testEventsRandom] = true
  //   // log('rpc send start', {eventEmitCounter})
  //   eventEmitBuffer.push(eventEmitCounter)
  //   var test = await netClient.rpc('civil-microservices_netclientworkers1', 'emitEvent', {type: 'test', data: {random: testEventsRandom, eventEmitCounter}})
  //   if (!test || !test.success)eventEmitErrors.push({test, eventEmitCounter})
  //   // mainTest.testRaw('SERVICE EMIT EVENT', test, (data) => data.success)
  //   // mainTest.consoleResume()
  // }, 1)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  var testEvents = await netClient.rpc('civil-microservices_netclientworkers1', 'getEvents', {type: 'test', service: 'test'}, {}, true, true, true, (stream) => {
    log('addedStream', {eventEmitCounter, stream})
    stream.on('readable', () => {
      var chunk
      while ((chunk = stream.read()) !== null) {
        eventReceiverCounter++
        eventReceiverBuffer.push(chunk.eventEmitCounter)
      }
    }).on('error', (data) => log('stream error', data)).on('end', (data) => log('stream end', data))
  }, (stream) => {
    log('removeStream', {eventEmitCounter, stream})
  })
  log('testEvents', testEvents)

  await new Promise((resolve) => setTimeout(resolve, 5000))
  mainTest.consoleResume()
  try {
    log('before SHOTDOWN', {eventEmitCounter})
    log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
    log('after SHOTDOWN', {eventEmitCounter})
  } catch (error) {
    log('rpc error', error)
  }
  await new Promise((resolve) => setTimeout(resolve, 5000))
  clearInterval(eventEmitInterval)
  // clearInterval(eventEmitInterval2)
  log('stop sending')
  await new Promise((resolve) => setTimeout(resolve, 10000))
  var filtered = eventEmitBuffer.filter(number => eventReceiverBuffer.indexOf(number) < 0)
  // var filtered2 = eventReceiverBuffer.filter(number => eventEmitBuffer.indexOf(number) < 0)
  log('eventReceiverBuffer', {filtered, eventEmitErrors})
  mainTest.testRaw('SERVICE TOTAL EVENTS', {eventEmitCounter, eventReceiverCounter}, (data) => data.eventEmitCounter === data.eventReceiverCounter)
  mainTest.consoleResume()
  log('testEvents', testEvents)

  testEvents.forEach(stream => {
    // console.dir(stream)
    stream.destroy()
  })

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

  var testEventsB = await netClient.rpc('civil-microservices_netclientworkers1', 'getEvents', {type: 'test2', service: 'test2'}, {}, true, true, true, (stream) => {
    log('addedStream', {testEventsBCounter, stream})
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
  var eventCallBuffer = []
  var eventCallErrors = []
  var eventCallInterval = setInterval(async () => {
    eventCallCounter++
    eventCallBuffer.push(eventCallCounter)
    try {
      var test = await netClient.rpc('civil-microservices_netclientworkers2', 'call', {service: 'civil-microservices_netclientworkers1', method: 'emitEvent', data: {type: 'test2', data: {'test': 'test', eventCallCounter}}})
      if (!test || !test.success)eventCallErrors.push({test, eventCallCounter})
    } catch (error) {
      eventCallErrors.push({error, eventCallCounter})
    }
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

  await new Promise((resolve) => setTimeout(resolve, 15000))
  log('before SHOTDOWN', {eventCallCounter})
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  await new Promise((resolve) => setTimeout(resolve, 1000))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers1', await netClient.rpc('civil-microservices_netclientworkers1', 'shutdown', {}))
  await new Promise((resolve) => setTimeout(resolve, 1000))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))
  await new Promise((resolve) => setTimeout(resolve, 1000))
  log('XXXXXXXXXX SHOTDOWN XXXXXXXXXXXXXXXX ->civil-microservices_netclientworkers2', await netClient.rpc('civil-microservices_netclientworkers2', 'shutdown', {}))
  log('after SHOTDOWN', {eventCallCounter})
  await new Promise((resolve) => setTimeout(resolve, 30000))
  clearInterval(eventCallInterval)
  await new Promise((resolve) => setTimeout(resolve, 10000))
  mainTest.consoleResume()
  var filtered = eventCallBuffer.filter(number => eventReceiverBBuffer.indexOf(number) < 0)

  log('eventEmitBBuffer', {filtered, eventCallErrors})
  mainTest.testRaw('SERVICE PROXY TOTAL EVENTS', {eventCallCounter, testEventsBCounter}, (data) => data.testEventsBCounter === data.eventCallCounter)

  return mainTest.finish()
}
module.exports = startTest
