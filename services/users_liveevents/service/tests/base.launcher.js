process.on('unhandledRejection', function (reason) {
  console.error('oops unhandledRejection', reason || new Error('unhandledRejection'))
  process.exit(1)
})

var startTest = async function () {
  var SERVICE = await require('../service')()
  var netClient = SERVICE.netClient
  await require('./base.test')(netClient)

  // SERVICE.httpServer.stop()
  // SERVICE.schemaClient.stop()
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  // process.exit()
}
startTest()
