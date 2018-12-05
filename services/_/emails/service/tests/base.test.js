process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'TEST', msg, data])) }
const debug = (msg, data) => { console.log('\n' + JSON.stringify(['DEBUG', 'TEST', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'TEST', msg, data])) }

process.env.debugMain = true
process.env.debugCouchbase = true
process.env.debugJesus = true
process.env.debugSchema = true
// process.env.smtpConfigJson = { 'host': '0.0.0.0', 'port': 1025, 'secure': false }

var startTest = async function (netClient) {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var CONFIG = require('../config')
  var ms = require('smtp-tester')
  var nodemailer = require('nodemailer')
  var mailServer = ms.init(1025)
  var mailHandler = function (addr, id, email) {
      // do something interesting
    debug('mailHandler', {addr, id, email})
  }
  mailServer.bind('foo@bar.com', mailHandler)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  var smtpTrans = nodemailer.createTransport({
    host: '0.0.0.0',
    port: 1025,
    secure: false,
    debug: true
  })
  var mailOptions = {
    to: 'foo@bar.com',
    from: CONFIG.mailFrom,
    subject: 'Benvenuto in CivilConnect - conferma la mail',
    html: '<h1>test</h1>',
    text: 'test'
  }
  var returnResult = await new Promise((resolve, reject) => smtpTrans.sendMail(mailOptions, (err, data) => err ? reject(err) : resolve(data)))
  debug('returnResult', returnResult)
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const auth = require('sint-bit-utils/utils/auth')
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 0)
  mainTest.consoleResume()

  async function setContext (contextData) {
    var i
    var tokens = {}
    for (i in contextData.emails)tokens[i] = await auth.createToken(i, contextData.emails[i], CONFIG.jwt)
    for (i in contextData.entities) await DB.put('view', Object.assign({ id: 'testDash_userTest', meta: {confirmed: true, created: Date.now(), updated: Date.now()}, dashId: 'testDash', roleId: 'subscriber', userId: 'userTest' }, contextData.entities[i]))
    Object.assign(netClient.testPuppets, contextData.testPuppets || {})
    return {
      tokens,
      data: contextData.data,
      updateData: (substitutions) => {
        var value
        for (var k in substitutions) {
          value = contextData.data
          k.split('/').forEach(addr => (value = value[addr]))
          value = substitutions[k]
        }
      },
      updatePuppets: (testPuppets) => Object.assign(netClient.testPuppets, testPuppets || {}),
      destroy: async() => {
        for (i in contextData.entities) await DB.remove(contextData.entities[i].id)
      }
    }
  }
  const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
  await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
  const dbGet = (id = 'userTest') => DB.get(id)
  const dbRemove = (id = 'userTest') => DB.remove(id)
  const dbQuery = (where, args) => DB.query('SELECT item.* from emails item WHERE DOC_TYPE="view" AND ' + where, args)

  mainTest.sectionHead('SERVICE INFO')
  var context = await setContext({users: { userTest: {} }})
  // mainTest.consoleResume()
  var test = await netClient.testLocalMethod('serviceInfo', {}, {token: context.tokens.userTest})
  mainTest.testRaw('SERVICE INFO', test, (data) => data.schema instanceof Object && data.mutations instanceof Object)
  mainTest.log('SERVICE INFO', test)
  await context.destroy()

  mainTest.sectionHead('REGISTER TEMPLATES')
  var template = {id: 'testTemplate', html: '<html>${data.msg}</html>', text: 'msg: ${data.msg}', subject: '${data.subject}'}
  test = await netClient.testLocalMethod('registerTemplates', {items: [template]}, {token: context.tokens.userTest})
  mainTest.testRaw('REGISTER TEMPLATES', test, (data) => data.results && data.results.length === 1)

  mainTest.sectionHead('COLLECT SMTP SENDED MAILS')
  var receiverdMails = []
  mailServer.bind('test@bar.com', (addr, id, email) => receiverdMails.push({addr, id, email}))
  mailServer.bind('test2@bar.com', (addr, id, email) => receiverdMails.push({addr, id, email}))
  mailServer.bind('test3@bar.com', (addr, id, email) => receiverdMails.push({addr, id, email}))
  mailServer.bind('test4@bar.com', (addr, id, email) => receiverdMails.push({addr, id, email}))
  // mailServer.bind('test@bar.com', (addr, id, email) => mainTest.log('MAIL on test@bar.com', {addr, id, email}))
  // mailServer.bind('test2@bar.com', (addr, id, email) => mainTest.log('MAIL on test2@bar.com', {addr, id, email}))

  mainTest.sectionHead('ADD TO QUEUE MULTI')
  var users = {items: [{email: 'test@bar.com'}, {email: 'test2@bar.com'}], extend: {data: {subject: 'prova messaggio', msg: 'prova messaggio', msg: 'prova messaggio'}, template: 'testTemplate'}}
  test = await netClient.testLocalMethod('addToQueueMulti', users, {token: context.tokens.userTest})
  mainTest.testRaw('ADD TO QUEUE MULTI', test, (data) => data.results && !data.errors)
  mainTest.log('ADD TO QUEUE MULTI response', test)

  mainTest.sectionHead('ADD TO QUEUE MULTI TEMPLATE RAW')
  var users = {items: [{email: 'test3@bar.com'}, {email: 'test4@bar.com'}], extend: {data: {subject: 'prova messaggio', msg: 'prova messaggio', msg: 'prova messaggio'}, rawTemplate: {html: '<html>template raw ${data.msg}</html>', text: 'template raw  msg: ${data.msg}', subject: 'template raw  ${data.subject}'}}}
  test = await netClient.testLocalMethod('addToQueueMulti', users, {token: context.tokens.userTest})
  mainTest.testRaw('ADD TO QUEUE MULTI', test, (data) => data.results && !data.errors)

  // mainTest.consoleResume()
  await new Promise((resolve) => setTimeout(resolve, 2000))

  mainTest.sectionHead('CHECK PROCESSED QUEUE')
  mainTest.log('CHECK PROCESSED QUEUE receiverdMails', receiverdMails)
  mainTest.testRaw('CHECK PROCESSED QUEUE', receiverdMails, (data) => data.length === 4)
  mainTest.testRaw('CHECK PROCESSED QUEUE', receiverdMails, (data) => data[0].email.html === '<html>prova messaggio</html>')
  mainTest.testRaw('CHECK PROCESSED QUEUE', receiverdMails, (data) => data[2].email.html === '<html>template raw prova messaggio</html>')

  await new Promise((resolve) => setTimeout(resolve, 1000))
  return mainTest.finish()
}
module.exports = startTest
