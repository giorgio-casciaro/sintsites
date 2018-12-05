process.on('unhandledRejection', (err, p) => {
  console.error(err)
  console.log('An unhandledRejection occurred')
  console.log(`Rejected Promise: ${p}`)
  console.log(`Rejection: ${err}`)
})

var methods = require('./methods')
var CONFIG = require('./config')

module.exports = async function start () {
  var netClient = require('sint-bit-utils/utils/netClient')
  await methods.init.exec(netClient)
  var httpServer = require('sint-bit-jesus/servers/http')({methods, config: CONFIG.http})
  var zeromqServer = require('sint-bit-jesus/servers/zeromq')({methods, config: CONFIG.zeromq})
  var zeromqPubSubServer = require('sint-bit-jesus/servers/zeromqPubSub')({methods, config: CONFIG.zeromq})
  await zeromqPubSubServer.start()
  await httpServer.start()
  await zeromqServer.start()
  return {
    netClient,
    httpServer,
    zeromqServer
  }
}
