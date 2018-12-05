process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
// process.env.smtpConfigJson = " { 'host': '0.0.0.0', 'port': 1025, 'secure': false, 'debug': true }"
var CONFIG = require('../config')
CONFIG.smtp = {
  host: '0.0.0.0',
  port: 1025,
  secure: false,
  debug: true
}
var startTest = async function () {
  const wait = require('sint-bit-utils/utils/wait')
  await wait.service('http://schema:10000/getSchema', 5000)
  await wait.service('http://couchbase:8091/')
  var SERVICE = await require('../service')()
  var netClient = SERVICE.netClient
  // await new Promise((resolve) => setTimeout(resolve, 5000))
  await require('./base.test')(netClient)

  SERVICE.netServer.stop()
  // SERVICE.schemaClient.stop()
  await new Promise((resolve) => setTimeout(resolve, 1000))
  process.exit()
}
startTest()
