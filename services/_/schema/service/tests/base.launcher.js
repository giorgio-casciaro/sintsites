process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})

var startTest = async function () {
  var SERVICE = await require('../service')()
  await require('./base.test')()
  SERVICE.server.connection.close()
  await new Promise((resolve) => setTimeout(resolve, 1000))
  process.exit()
}
startTest()
