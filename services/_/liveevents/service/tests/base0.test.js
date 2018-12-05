process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})
var path = require('path')

var startTest = async function (netClient) {
  var aerospike = require('../config').aerospike
  aerospike.set = 'liveevents_test_set'
  aerospike.mutationsSet = 'liveevents_test_mutations_set'
  aerospike.viewsSet = 'liveevents_test_views_set'

  // PREPARE DB
  var microRandom = Math.floor(Math.random() * 100000)
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db conenctions', 0)
  var microTest = mainTest.test
  var finishTest = mainTest.finish

  var fs = require('fs')
  fs.createReadStream(path.join(__dirname, '/test.png')).pipe(fs.createWriteStream(path.join(__dirname, '/test_send.png')))
  await new Promise((resolve) => setTimeout(resolve, 1000))

  var fields = {
    publicName: `sir test_user ${microRandom}. junior`,
    pic: {
      mimetype: 'image/png',
      path: path.join(__dirname, '/test_send.png')
    },
    email: `test${microRandom}@test${microRandom}.com`,
    password: `t$@es${microRandom}Tt$te1st_com`,
    newPassword: `new_t$@es${microRandom}Tt$te1st_com`,
    firstName: `t$@es${microRandom}Tt$te1st_com`,
    lastName: `t$@es${microRandom}Tt$te1st_com`
  }
  console.log('fields', fields)

  var basicMeta = {}
  // var createReq = {
  //   password: `${microRandom}`,
  //   confirm: `${microRandom}`
  // }
  // var wrongPasswordReq = Object.assign({}, basicUser, {
  //   password: `${microRandom}`,
  //   confirm: `${microRandom}`
  // })
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

  var createWrongMail = await netClient.testLocalMethod('create', { email: `${microRandom}` }, basicMeta)
  microTest(createWrongMail, {error: 'string'}, 'wrong request: email not valid', TYPE_OF, 2)

  var create = await netClient.testLocalMethod('create', { email: fields.email }, basicMeta)
  microTest(create, { success: 'User created' }, 'User Create', FILTER_BY_KEYS)

  var wrongRecreate = await netClient.testLocalMethod('create', { email: fields.email }, basicMeta)
  microTest(wrongRecreate, { error: 'User exists' }, 'wrong request: User exists', FILTER_BY_KEYS)

  var readEmailConfirmationCode = await netClient.testLocalMethod('readEmailConfirmationCode', {id: create.id}, basicMeta)
  microTest(readEmailConfirmationCode, {emailConfirmationCode: 'string'}, 'read Email Confirmation Code', TYPE_OF)

  var confirmEmail = await netClient.testLocalMethod('confirmEmail', { email: fields.email, emailConfirmationCode: readEmailConfirmationCode.emailConfirmationCode }, basicMeta)
  microTest(confirmEmail, { success: 'Email confirmed' }, 'Email confirmed', FILTER_BY_KEYS)

  var assignPassword = await netClient.testLocalMethod('assignPassword', {email: fields.email, password: fields.password, confirmPassword: fields.password}, basicMeta)
  microTest(assignPassword, { success: 'string' }, 'assignPassword', TYPE_OF)

  var login = await netClient.testLocalMethod('login', {email: fields.email, password: fields.password}, basicMeta)
  microTest(login, { success: 'string', token: 'string' }, 'login', TYPE_OF)

  basicMeta.token = login.token

  var readPrivate = await netClient.testLocalMethod('readPrivate', {id: create.id}, basicMeta)
  microTest(readPrivate, {email: fields.email}, 'readPrivate', FILTER_BY_KEYS)
  microTest(readPrivate, {emailConfirmationCode: 'undefined'}, 'readPrivate', TYPE_OF)

  var updatePublicName = await netClient.testLocalMethod('updatePublicName', {id: create.id, publicName: fields.publicName}, basicMeta)
  microTest(updatePublicName, { success: 'string' }, 'updatePublicName', TYPE_OF)
  var readPublicName = await netClient.testLocalMethod('read', {id: create.id}, basicMeta)
  microTest(readPublicName, {publicName: fields.publicName}, 'readPublicName', FILTER_BY_KEYS)

  var updatePic = await netClient.testLocalMethod('updatePic', {id: create.id, pic: fields.pic}, basicMeta)
  microTest(updatePic, { success: 'string' }, 'updatePic', TYPE_OF)
  var getPic = await netClient.testLocalMethod('getPic', {id: create.id}, basicMeta)
  microTest(typeof getPic, 'string', 'getPic')

  var updatePersonalInfo = await netClient.testLocalMethod('updatePersonalInfo', {id: create.id, firstName: fields.firstName, lastName: fields.lastName, birth: fields.birth}, basicMeta)
  microTest(updatePersonalInfo, { success: 'string' }, 'updatePersonalInfo', TYPE_OF)
  var readPersonalInfo = await netClient.testLocalMethod('readPersonalInfo', {id: create.id}, basicMeta)
  microTest(readPersonalInfo, {firstName: fields.firstName}, 'readPersonalInfo', FILTER_BY_KEYS)

  var updatePassword = await netClient.testLocalMethod('updatePassword', {id: create.id, password: fields.newPassword, confirmPassword: fields.newPassword, oldPassword: fields.password}, basicMeta)
  microTest(updatePassword, { success: 'string' }, 'updatePassword', TYPE_OF)

  var remove = await netClient.testLocalMethod('remove', { id: create.id }, basicMeta)
  microTest(remove, {success: 'User removed'}, 'remove')
  var readRemove = await netClient.testLocalMethod('read', { id: create.id }, basicMeta)
  microTest(readRemove, { error: 'string' }, 'readRemove', TYPE_OF)

  var rpcCreateUserN = (n) => netClient.testLocalMethod('create', { email: n + '_' + fields.email }, basicMeta)

  var testTimestamp1 = Date.now()
  await rpcCreateUserN(1)
  await rpcCreateUserN(2)
  await rpcCreateUserN(3)
  var testTimestamp2 = Date.now()
  await rpcCreateUserN(4)
  await rpcCreateUserN(5)
  await rpcCreateUserN(6)

  var queryResponse = await netClient.testLocalMethod('queryByTimestamp', {from: testTimestamp1}, basicMeta)
  microTest(queryResponse, 6, 'queryResponse insert and query 6 items from testTimestamp1', COUNT)
  var queryResponse2 = await netClient.testLocalMethod('queryByTimestamp', {from: testTimestamp2}, basicMeta)
  microTest(queryResponse2, 3, 'queryResponse insert and query 3 items  from testTimestamp2', COUNT)

  // finishTest()
  // SERVICE.netServer.stop()
  await new Promise((resolve) => setTimeout(resolve, 1000))
  // process.exit()
  return finishTest()
}
module.exports = startTest
