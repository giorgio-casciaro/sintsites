const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'MAIN', msg, data])) }
const debug = (msg, data) => { if (process.env.debugMain)console.log('\n' + JSON.stringify(['DEBUG', 'MAIN', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'MAIN', msg, data])); console.error(data) }

process.on('unhandledRejection', (err, p) => {
  console.error(err)
  console.log('An unhandledRejection occurred')
  console.log(`Rejected Promise: ${p}`)
  console.log(`Rejection: ${err}`)
})

module.exports = async function service () {
  var lookSetServiceSchema = false
  // BASE
  const CONFIG = require('./config')
  const getConsole = (serviceName, serviceId, pack) => require('sint-bit-utils/utils/utils').getConsole({error: true, debug: true, log: true, warn: true}, serviceName, serviceId, pack)
  var PACKAGE = 'schemaMs'
  var CONSOLE = getConsole(PACKAGE, '----', '-----')

  // SERVICES DEPENDECIES
  const wait = require('sint-bit-utils/utils/wait')
  debug('PREINIT SCHEMA')
  await wait.service('http://couchbase:8091/')
  debug('INIT SCHEMA')

  // EXPRESS
  const express = require('express')
  const app = express()
  var server = {}
  const bodyParser = require('body-parser')
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))
  // DB
  debug('INIT SCHEMA')
  const DB = require('sint-bit-utils/utils/dbCouchbaseV2')
  await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password)

  const loadSchema = async () => {
    var rawSchema = await DB.get('schema', 'schema')
    debug('rawSchema', rawSchema)
    return rawSchema || { id: 'schema', services: {} }
  }
  const saveSchema = async (specificSchema) => {
    if (specificSchema)SCHEMA = specificSchema
    var result = await DB.put('schema', SCHEMA)
    CONSOLE.hl('saveSchema', result)
    return result
  }
  var SCHEMA = { id: 'schema', services: {} }
  try { SCHEMA = await loadSchema() } catch (error) { await saveSchema() }
  debug('SCHEMA', SCHEMA)

  // LIVE SIGNAL
  var liveSignals = {}
  var liveSignalTime = 1000 * 10
  async function checkLiveServices () {
    CONSOLE.log('checkLiveServices')
    var currentTime = Date.now()
    // SCHEMA = await loadSchema()
    var schemaUpdated = false
    var serviceName
    for (serviceName in SCHEMA.services) {
      if (!liveSignals[serviceName]) {
        delete SCHEMA.services[serviceName]
        schemaUpdated = true
        CONSOLE.log('service removed', serviceName)
        if (SCHEMA.services[serviceName])CONSOLE.log('error service not removed', SCHEMA.services[serviceName])
      }
    }
    for (serviceName in liveSignals) {
      if (liveSignals[serviceName] < currentTime - liveSignalTime) {
        delete SCHEMA.services[serviceName]
        delete liveSignals[serviceName]
        schemaUpdated = true
        CONSOLE.log('service removed', serviceName)
        if (SCHEMA.services[serviceName])CONSOLE.log('error service not removed', SCHEMA.services[serviceName])
      }
    }
    if (schemaUpdated) await saveSchema(SCHEMA)
  }
  setInterval(checkLiveServices, 1000)
  function liveSignal (service) {
    CONSOLE.log('liveSignal', service, Date.now())
    if (service) {
      liveSignals[service] = Date.now()
      if (!SCHEMA.services[service]) return {status: 2, msg: 'service not registered'}
      return {status: 1, msg: 'liveSignal updated'}
    }
    return {status: 0, msg: 'service not defined'}
  }
  // DOMAIN
  app.get('/getSchema', async function (req, res) {
    CONSOLE.log('getSchema')
    res.setHeader('Content-Type', 'application/json')
    SCHEMA = await loadSchema()
    res.send(JSON.stringify(SCHEMA))
  })
  app.get('/getPublicMethodsSchema', async function (req, res) {
    SCHEMA = await loadSchema()
    var publicSchema = {}
    for (var serviceName in SCHEMA) {
      if (SCHEMA.services[serviceName].exportToPublicApi) {
        publicSCHEMA.services[serviceName] = {}
        for (var methodName in SCHEMA.services[serviceName].methods) {
          if (SCHEMA.services[serviceName].methods[methodName].public) {
            publicSCHEMA.services[serviceName][methodName] = SCHEMA.services[serviceName].methods[methodName].requestSchema
          }
        }
      }
    }
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify(publicSchema))
  })
  app.get('/liveSignal', (req, res) => {
    var service = req.query.service
    res.send(liveSignal(service))
  })
  app.post('/setServiceSchema', async function (req, res) {
    CONSOLE.hl('setServiceSchema', req.body.service)
    while (lookSetServiceSchema) {
      CONSOLE.log('lookSetServiceSchema', req.body.service)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    lookSetServiceSchema = true
    SCHEMA = await loadSchema()
    SCHEMA.services[req.body.service] = JSON.parse(req.body.schema)
    liveSignal(req.body.service)
    await saveSchema()
    res.setHeader('Content-Type', 'application/json')
    res.send({success: 'schema received'})
    lookSetServiceSchema = false
  })
  app.post('/removeServiceSchema', async function (req, res) {
    try {
      CONSOLE.log('removeServiceSchema', req.body, SCHEMA)
      SCHEMA = await loadSchema()
      delete SCHEMA.services[req.body.service]
      CONSOLE.log('removeServiceSchema', req.body, SCHEMA)
      await saveSchema()
    } catch (error) {
      CONSOLE.log('setServiceSchema error', SCHEMA, error)
    }
    res.setHeader('Content-Type', 'application/json')
    res.send({success: 'schema removed'})
  })

  debug('app.listen', CONFIG.httpPort)
  server.connection = app.listen(CONFIG.httpPort)

  return {
    CONFIG,
    app,
    server
  }
}
