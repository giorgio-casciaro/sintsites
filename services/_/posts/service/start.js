// SERVICES DEPENDECIES
var start = async() => {
  const wait = require('sint-bit-utils/utils/wait')
  await wait.service('http://schema:10000/getSchema', 5000)
  await wait.serviceResponse('http://users:10080/status',{serviceStarted:true})
  await wait.service('http://dashboards:10080/')
  await wait.service('http://subscriptions:10080/')
  await wait.service('http://couchbase:8091/')
  console.log('INIT SCHEMA')
  require('./service')()
}
start()
