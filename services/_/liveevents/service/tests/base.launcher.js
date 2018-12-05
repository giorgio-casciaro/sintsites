process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})

var startTest = async function () {
  var SERVICE = await require('../service')()
  var netClient = SERVICE.netClient
  await new Promise((resolve) => setTimeout(resolve, 5000))
  await require('./base.test')(netClient, SERVICE.getServiceSchema)

  SERVICE.netServer.stop()
  // SERVICE.schemaClient.stop()
  await new Promise((resolve) => setTimeout(resolve, 1000))
  process.exit()
}
startTest()
