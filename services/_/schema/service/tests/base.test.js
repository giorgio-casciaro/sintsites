process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
var path = require('path')
var request = require('request-promise-native')

var startTest = async function () {
  var config = require('../config')

  // PREPARE DB
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db conenctions', -1)
  var microTest = mainTest.test
  var finishTest = mainTest.finish

  var basicMeta = {}
  const TYPE_OF = (actual, expected) => {
    var filtered = {}
    Object.keys(expected).forEach((key) => { filtered[key] = typeof actual[key] })
    return filtered
  }
  const FILTER_BY_KEYS = (actual, expected) => {
    var filtered = {}
    Object.keys(expected).forEach((key) => { filtered[key] = actual[key] })
    return filtered
  }
  const COUNT = (actual, expected) => actual.length

  var setServiceSchema = await request.post(`http://${config.httpHost}:${config.httpPort}/setServiceSchema`, { form: { service: 'test', schema: JSON.stringify({ test_field: 'test' }) } })
  microTest(JSON.parse(setServiceSchema), {success: 'schema received'}, 'setServiceSchema')
  var setServiceSchema2 = await request.post(`http://${config.httpHost}:${config.httpPort}/setServiceSchema`, { form: { service: 'test2', schema: JSON.stringify({ test_field: 'test2' }) } })
  microTest(JSON.parse(setServiceSchema2), {success: 'schema received'}, 'setServiceSchema')

  var getSchema = await request.get(`http://${config.httpHost}:${config.httpPort}/getSchema`)
  microTest(JSON.parse(getSchema), { id: 'schema', 'services': {test: { test_field: 'test' }, test2: { test_field: 'test2' }} }, 'getSchema')

  var removeServiceSchema = await request.post(`http://${config.httpHost}:${config.httpPort}/removeServiceSchema`, { form: { service: 'test' } })
  microTest(JSON.parse(removeServiceSchema), {success: 'schema removed'}, 'removeServiceSchema')

  var getSchema2 = await request.get(`http://${config.httpHost}:${config.httpPort}/getSchema`)
  microTest(JSON.parse(getSchema2), { id: 'schema', 'services': {test2: { test_field: 'test2' }} }, 'getSchema Removed ')

  return finishTest()
}
module.exports = startTest
