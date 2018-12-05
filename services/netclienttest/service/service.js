process.on('unhandledRejection', (err, p) => {
  console.error(err)
  console.log('An unhandledRejection occurred')
  console.log(`Rejected Promise: ${p}`)
  console.log(`Rejection: ${err}`)
})

var methods = require('./methods')
var CONFIG = require('./config')
if (!process.env.IPADDRESS)process.env.IPADDRESS = require('os').networkInterfaces()['eth0'][0].address
// console.log('process.env', process.env)

module.exports = async function start () {
  var netClient = require('sint-bit-utils/utils/netClient')

  await methods.init(netClient)
  var httpServer = require('sint-bit-jesus/servers/http')({methods, config: CONFIG.http})
  var zeromqServer = require('sint-bit-jesus/servers/zeromq')({methods, config: CONFIG.zeromq})
  await httpServer.start()
  await zeromqServer.start()
  return {
    netClient,
    httpServer,
    zeromqServer
  }
}
