process.on('unhandledRejection', function (reason) {
  console.error('oops unhandledRejection', reason || new Error('unhandledRejection'))
  process.exit(1)
})

var startTest = async function () {
  const wait = require('sint-bit-utils/utils/wait')
  await wait.service('http://netclientworkers1/echo', 5000)
  await wait.service('http://netclientworkers2/echo', 5000)

  var SERVICE = await require('../service')()
  var netClient = SERVICE.netClient
  // await new Promise((resolve) => setTimeout(resolve, 5000))
  await require('./base.test')(netClient)

  // SERVICE.httpServer.stop()
  // SERVICE.schemaClient.stop()
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // process.exit()
}
startTest()
