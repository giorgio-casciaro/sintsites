process.on('unhandledRejection', function (reason) {
  console.error('oops', reason)
  process.exit(1)
})

var startTest = async function (netClient) {
  await new Promise((resolve) => setTimeout(resolve, 1000))

  var rpcCall = (to, method, data, meta) => netClient.rpcCall({to, method, data, meta})
  var microRandom = Math.floor(Math.random() * 100000)
  var mainTest = require('sint-bit-utils/utils/microTest')('test Microservice local methods and db connections', 0)
  var microTest = mainTest.test
  var finishTest = mainTest.finish

  const TYPE_OF = (actual, expected) => {
    if (typeof (expected) !== 'object') {
      var type = typeof (actual)
      if (Array.isArray(actual))type = 'array'
      return type
    }
    var filtered = {}
    Object.keys(expected).forEach((key) => { filtered[key] = typeof actual[key] })
    return filtered
  }
  const FILTER_BY_KEYS = (actual, expected) => {
    var filtered = {}
    Object.keys(expected).forEach((key) => { filtered[key] = actual[key] })
    return filtered
  }
  // const COUNT = (actual, expected) => actual.length

  var fields = {
    name: `Dashboard name`,
    public: true,
    description: `Dashboard description`,
    description2: `Dashboard description 2`,
    tags: ['test', 'tag2', 'tag3'],
    maps: [{
      centerLat: 14.0005,
      centerLng: 14.0005,
      zoom: 5
    }],
    options: {
      guestRead: 'allow',
      guestSubscribe: 'allow',
      guestWrite: 'allow',
      subscriberWrite: 'allow'
    }
  }

  // await netClient.rpc('testRpcNoResponse', {'test_data': 1}, meta)
  var createUser = async (userData) => {
    var user = await rpcCall('users', 'create', userData, {})
    microTest(user, { success: 'User created' }, 'User Create', FILTER_BY_KEYS)

    var readEmailConfirmationCode = await rpcCall('users', 'readEmailConfirmationCode', {id: user.id}, {})
    microTest(readEmailConfirmationCode, {emailConfirmationCode: 'string'}, 'User read Email Confirmation Code', TYPE_OF)

    var confirmEmailResp = await rpcCall('users', 'confirmEmail', { email: userData.email, emailConfirmationCode: readEmailConfirmationCode.emailConfirmationCode }, {})
    microTest(confirmEmailResp, { success: 'Email confirmed' }, 'User Email confirmed', FILTER_BY_KEYS)

    var assignPasswordResp = await rpcCall('users', 'assignPassword', {email: userData.email, password: userData.password, confirmPassword: userData.password}, {})
    microTest(assignPasswordResp, { success: 'string' }, 'User assignPassword', TYPE_OF)

    var login = await rpcCall('users', 'login', {email: userData.email, password: userData.password}, {})
    microTest(login, { success: 'string', token: 'string' }, 'User login', TYPE_OF)
    user.token = login.token
    return user
  }

  var userData = {
    publicName: `sir test_user ${microRandom}. junior`,
    email: `test${microRandom}@test${microRandom}.com`,
    password: `t$@es${microRandom}Tt$te1st_com`,
    newPassword: `new_t$@es${microRandom}Tt$te1st_com`,
    firstName: `t$@es${microRandom}Tt$te1st_com`,
    lastName: `t$@es${microRandom}Tt$te1st_com`
  }

  var userData2 = {
    publicName: `sir test_user 2 ${microRandom}. junior`,
    email: `test2${microRandom}@test${microRandom}.com`,
    password: `t$@es2${microRandom}Tt$te1st_com`,
    newPassword: `new_2t$@es${microRandom}Tt$te1st_com`,
    firstName: `t$@2es${microRandom}Tt$te1st_com`,
    lastName: `t$@2es${microRandom}Tt$te1st_com`
  }

  var user1 = await createUser(userData)
  var user2 = await createUser(userData2)

  // CREATE DASH
  var create = await rpcCall('dashboards', 'create', {
    name: `Dashboard name`,
    public: true,
    description: `Dashboard description`,
    description2: `Dashboard description 2`,
    tags: ['test', 'tag2', 'tag3'],
    maps: [{
      centerLat: 14.0005,
      centerLng: 14.0005,
      zoom: 5
    }],
    options: {
      guestRead: 'allow',
      guestSubscribe: 'allow',
      guestWrite: 'allow',
      subscriberWrite: 'allow'
    }
  }, {token: user1.token})
  microTest(create, { success: 'Dashboard created' }, 'Dashboard Create', FILTER_BY_KEYS, 0, fields)

  // SUBSCRIPTIONS
  var wrongSubscription = {
    dashId: create.id,
    roleId: 'admin',
    userId: user2.id,
    notifications: ['email', 'sms', 'fb']
  }

  var subscription = {
    dashId: create.id,
    roleId: 'subscriber',
    userId: user2.id,
    tags: ['testTag'],
    notifications: ['email', 'sms', 'fb']
  }

  // WRONG SUB, user2 cant create not public roles
  var createWrongSubscription = await netClient.testLocalMethod('create', wrongSubscription, {token: user2.token})
  microTest(createWrongSubscription, { error: 'string' }, 'createWrongSubscription', TYPE_OF)

  var subscriptionsCreate = await netClient.testLocalMethod('create', subscription, {token: user2.token})
  microTest(subscriptionsCreate, { success: 'Subscription created' }, 'subscriptionsCreate', FILTER_BY_KEYS)

  var subscriptionsRead = await netClient.testLocalMethod('read', { id: subscriptionsCreate.id }, {token: user2.token})
  microTest(subscriptionsRead, {name: subscription.name, dashId: create.id}, 'subscriptionsRead', FILTER_BY_KEYS)
  microTest(subscriptionsRead, {notifications: 'object'}, 'subscriptionsRead notifications', TYPE_OF)

  var subscriptionsUpdate = await netClient.testLocalMethod('update', { id: subscriptionsCreate.id, roleId: 'admin' }, {token: user1.token})
  microTest(subscriptionsUpdate, { success: 'Subscription updated' }, 'subscriptionsUpdate', FILTER_BY_KEYS, 0, { id: subscriptionsCreate.id, roleId: 'admin' })

  var subscriptionsRead2 = await netClient.testLocalMethod('read', { id: subscriptionsCreate.id }, {token: user2.token})
  microTest(subscriptionsRead2, {roleId: 'admin'}, 'subscriptionsRead2', FILTER_BY_KEYS)

  var subscriptionsUpdate2 = await netClient.testLocalMethod('update', { id: subscriptionsCreate.id, roleId: 'subscriber' }, {token: user2.token})
  microTest(subscriptionsUpdate2, { success: 'Subscription updated' }, 'subscriptionsUpdate', FILTER_BY_KEYS, 0, { id: subscriptionsCreate.id, roleId: 'subscriber' })

  var subscriptionsRemove = await netClient.testLocalMethod('remove', { id: subscriptionsCreate.id }, {token: user2.token})
  microTest(subscriptionsRemove, { success: 'Subscription removed' }, 'Subscription remove', FILTER_BY_KEYS)

  var wrongsubscriptionsRead = await netClient.testLocalMethod('read', { id: subscriptionsCreate.id }, {token: user2.token})
  microTest(wrongsubscriptionsRead, { error: 'string' }, 'Wrong subscriptionsRead (Subscription removed)', TYPE_OF)

  // SUBSCRIPTIONS QUERY
  const uuid = require('uuid/v4')

  var rpcsubscriptionsCreateN = (n) => netClient.testLocalMethod('create', {
    dashId: create.id,
    roleId: 'subscriber',
    userId: uuid(),
    tags: ['testTag', 'testTag2'],
    notifications: ['email', 'sms', 'fb']
  }, {token: user1.token})

  for (var i = 0; i < 50; i++) {
    var subscriptionsCreateN = await rpcsubscriptionsCreateN(i)
    microTest(subscriptionsCreateN, { success: 'Subscription created' }, 'subscriptionsCreateN' + i, FILTER_BY_KEYS)
  }
//   var subscriptionsListLast = await netClient.testLocalMethod('subscriptionsListLast', { dashId: create.id, from: 0, to: 10 }, {token: user1.token})
  // console.log('subscriptionsListLast', subscriptionsListLast)
  var subscriptionsListLast = await netClient.testLocalMethod('listLast', { dashId: create.id, from: 0, to: 10 }, {token: user1.token})
  microTest(subscriptionsListLast[0] || [], {dashId: create.id}, 'subscriptionsListLast', FILTER_BY_KEYS)
  microTest(subscriptionsListLast.length, 10, 'subscriptionsListLast Number')
  mainTest.consoleResume()
  console.log('subscriptionsListLast', subscriptionsListLast)
  mainTest.consoleMute()
  // return finishTest()
  var subscriptionsGetExtendedByUserId = await netClient.testLocalMethod('getExtendedByUserId', { }, {token: user2.token})
  microTest(subscriptionsGetExtendedByUserId, 'array', 'subscriptionsGetExtendedByUserId', TYPE_OF, 0)
  // mainTest.consoleResume()
  var subscriptionsListByDashIdTagsRoles_admin = await netClient.testLocalMethod('listByDashIdTagsRoles', { dashId: create.id, roles: ['admin'] }, {token: user1.token})
  // console.log('subscriptionsListByDashIdTagsRoles_admin', subscriptionsListByDashIdTagsRoles_admin)
  microTest(subscriptionsListByDashIdTagsRoles_admin, 'array', 'listByDashIdTagsRoles_admin', TYPE_OF, 0)

  microTest(subscriptionsListByDashIdTagsRoles_admin[0], {roleId: 'admin'}, 'listByDashIdTagsRoles_admin', FILTER_BY_KEYS)

  var subscriptionsListByDashIdTagsRoles_testTag = await netClient.testLocalMethod('listByDashIdTagsRoles', { dashId: create.id, tags: ['testTag'] }, {token: user1.token})
  microTest(subscriptionsListByDashIdTagsRoles_testTag, 'array', 'subscriptionsListByDashIdTagsRoles', TYPE_OF, 0)

  await new Promise((resolve) => setTimeout(resolve, 1000))
  return finishTest()
}
module.exports = startTest
