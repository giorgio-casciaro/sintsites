const path = require('path')
const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
var CONFIG = require('./config')
var netClient
// process.env.debugMain = true
const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'MAIN', msg, data])) }
const debug = (msg, data) => { if (process.env.debugMain)console.log('\n' + JSON.stringify(['DEBUG', 'MAIN', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'MAIN', msg, data])); console.error(data) }

const arrayToObjBy = (array, prop) => array.reduce((newObj, item) => { newObj[item[prop]] = item; return newObj }, {})

var resultsError = (item, msg) => { return {id: item.id || 'unknow', __RESULT_TYPE__: 'error', error: msg} }

const nodemailer = require('nodemailer')
const vm = require('vm')
const fs = require('fs')

// SMTP
var smtpTrans = nodemailer.createTransport(CONFIG.smtp, {from: CONFIG.mailFrom})
debug('smtpTrans createTransport', CONFIG)
const getMailTemplate = async (data) => {
  var templateInfo = {html: 'html', text: 'text', subject: 'subject'}
  if (data.rawTemplate) {
    templateInfo = data.rawTemplate
    delete data.rawTemplate
  } else if (data.template) {
    var templateFromDb = await DB.get(data.template)
    if (templateFromDb)templateInfo = templateFromDb
  }
  // var templatefromDb = await DB.get(data.template)
  // if (templatefromDb)templateInfo = templatefromDb
  debug('getMailTemplate', { templateInfo, data })
  var populate = (content) => vm.runInNewContext('returnVar=`' + content.replace(new RegExp('`', 'g'), '\\`') + '`', data)
  var result = { html: populate(templateInfo.html), text: populate(templateInfo.text), subject: populate(templateInfo.subject) }
  debug('getMailTemplate', { result })
  return result
}
const sendMail = async (mailData) => {
  var populatedTemplate = await getMailTemplate(mailData)
  // mailOptions.html = populatedTemplate.html
  // mailOptions.text = populatedTemplate.text
  // mailOptions.subject = populatedTemplate.subject
  populatedTemplate.to = mailData.email
  log('sendMail', { populatedTemplate, sendEmails: process.env.sendEmails })
  if (!process.env.sendEmails) return true
  var returnResult = await new Promise((resolve, reject) => smtpTrans.sendMail(populatedTemplate, (err, data) => err ? reject(err) : resolve(data)))
  log('sendMail', { returnResult })
  return returnResult
}
var sendLoopActive = true
var sendLoop = async function () {
  try {
    while (sendLoopActive) {
      var result = await DB.queuePop('emailQueue')
      debug('sendLoop', {result})
      if (result) await sendMail(result)
      else await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  } catch (err) {
    error('sendLoop Error', err)
    sendLoop()
  }
}
// var itemId = (item) => uuidv4()

module.exports = {
  addToQueueMulti: async function (reqData, meta, getStream) {
    if (reqData.extend)reqData.items = reqData.items.map(data => Object.assign(data, reqData.extend))
    var results = await DB.queuePushMulti('emailQueue', reqData.items)
    return {results}
  },
  registerTemplates: async function (reqData, meta, getStream) {
    if (reqData.extend)reqData.items = reqData.items.map(data => Object.assign(data, reqData.extend))
    debug('reqData', reqData)
    var results = await DB.upsertMulti('template', reqData.items)
    debug('results', results)
    return {results}
  },
  init: async function (setNetClient) {
    netClient = setNetClient
    log('CONFIG.couchbase', CONFIG.couchbase)
    await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
    await DB.createIndex(['email'])
    await DB.createIndex(['DOC_TYPE'])
    sendLoop()
    // await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.emailname, CONFIG.couchbase.password)
    // // await DB.createIndex('emailsViews', ['dashId', 'userId'])
    // await DB.createIndex('emailsViews', ['objectId', 'userId'])
  },
  async  serviceInfo (reqData, meta = {directCall: true}, getStream = null) {
    var schema = require('./schema')
    var schemaOut = {}
    for (var i in schema.methods) if (schema.methods[i].public) schemaOut[i] = schema.methods[i].requestSchema
    var mutations = {}
    require('fs').readdirSync(path.join(__dirname, '/mutations')).forEach(function (file, index) { mutations[file] = require(path.join(__dirname, '/mutations/', file)).toString() })
    debug('serviceInfo', {schema, mutations})
    return {schema: schemaOut, mutations}
  }
}
