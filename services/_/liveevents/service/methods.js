// var MongoClient = require('mongodb').MongoClient
process.on('unhandledRejection', (err, p) => {
  console.log('An unhandledRejection occurred')
  console.log(`Rejected Promise: ${p}`)
  console.log(`Rejection: ${err}`)
})

var CONFIG = require('./config')
const auth = require('sint-bit-utils/utils/auth')
var netClient

const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'MAIN', msg, data])) }
const debug = (msg, data) => { if (process.env.debugMain)console.log('\n' + JSON.stringify(['DEBUG', 'MAIN', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'MAIN', msg, data])); console.error(data) }

const arrayToObjBy = (array, prop) => array.reduce((newObj, item) => { newObj[item[prop]] = item; return newObj }, {})

const EventEmitter = require('events')
class JesusProxyEventsEmitter extends EventEmitter {}
const jesusProxy = new JesusProxyEventsEmitter()
const bufferEvents = []
const maxBufferLength = 100000
function bufferEventsAdd (event) {
  event.timestamp = Date.now()
  bufferEvents.unshift(event)
  if (bufferEvents.length >= maxBufferLength) bufferEvents.pop()
}
function bufferEventsGetFrom (timestamp) {
  return bufferEvents.filter((event) => event.timestamp >= timestamp)
}

var rpcSubscriptionsListByUserId = (userId, meta) => netClient.rpcCall({to: 'subscriptions', method: 'listByUserId', data: {userId}, meta})

module.exports = {
  init: async function (setNetClient) {
    netClient = setNetClient
  },
  async testEvent (query = {}, meta = {directCall: true}, getStream = null) {
    return {test: 'test'}
  },
  async triggerEvent (event = {}, meta = {directCall: true}, getStream = null) {
    event.from = meta.from
    debug('triggerEvent', { event, meta })
    bufferEventsAdd(event)
    jesusProxy.emit('event', event)
    return {success: 'event triggered'}
  },
  async getEvents (query = {}, meta = {directCall: true}, getStream = null) {
    var userId = await auth.getUserIdFromToken(query, CONFIG.jwt)
    var subscriptions = await rpcSubscriptionsListByUserId(userId, meta)
    if (subscriptions.errors) throw new Error('rpcSubscriptionsListByUserId => ' + subscriptions.errors)
    var subscriptionsByDashId = arrayToObjBy(subscriptions.results, 'dashId')
    const writeStream = (eventObj) => {
      debug('stream.write', eventObj)
      if (eventObj.filters) {
        if (eventObj.filters.users && (!userId || !eventObj.filters.users.find((user) => user.userId === userId))) return false
        if (eventObj.filters.dashId) {
          if (!subscriptionsByDashId[eventObj.filters.dashId]) return false
          var subscription = subscriptionsByDashId[eventObj.filters.dashId]
          if (eventObj.filters.toRoles || eventObj.filters.toTags) {
            if (!subscription.tags || !subscription.roleId) return false
            var toTagsIntersection = true
            if (eventObj.filters.toTags)toTagsIntersection = subscription.tags.filter((tag) => eventObj.filters.toTags.includes(tag)).length > 0
            var toRolesIntersection = true
            if (eventObj.filters.toRoles)toRolesIntersection = eventObj.filters.toRoles.includes(subscription.roleId)
            if (!toTagsIntersection && !toRolesIntersection) return false
          }
        }
      }
      stream.write(eventObj)
    }

    const closeStream = () => jesusProxy.removeListener('userEvent', writeStream)
    var stream = getStream(closeStream, query.timeout || 120000)
    if (query.fromTimestamp) {
      var oldEvents = bufferEventsGetFrom(query.fromTimestamp)
      debug('oldEvents', oldEvents)
      oldEvents.forEach(writeStream)
    }
    jesusProxy.on('event', writeStream)
        // writeStream({event: {'start': 1}, timestamp: Date.now()})
  }
}
