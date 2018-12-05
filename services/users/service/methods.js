const path = require('path')
const EventEmitter = require('events')
const uuidv4 = require('uuid/v4')
const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
const EMAIL = require('sint-bit-utils/utils/email')
var CONFIG = require('./config')
var mutationsPack = require('sint-bit-cqrs/mutations')({ mutationsPath: path.join(__dirname, '/mutations') })
const auth = require('sint-bit-utils/utils/auth')
var netClient

process.env.debugMain = true
// process.env.debugCouchbase = true
// process.env.debugJesus = true
// process.env.debugSchema = true

// autotest
// slect case in db

const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'MAIN', msg, data])) }
const debug = (msg, data) => { if (process.env.debugMain)console.log('\n' + JSON.stringify(['DEBUG', 'MAIN', msg, data])) }
const errorLog = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'MAIN', msg, data])); console.error(data) }
var itemId = (item) => uuidv4()

var entitySchemaProperties = {
  id: {
    type: 'string',
    description: 'id in format UUID v4',
    pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
  },
  name: { type: 'string' },
  firstName: { type: 'string' },
  lastName: { type: 'string' },
  birth: { type: 'string' },
  publicName: { type: 'string' },
  public: { type: 'boolean' },
  email: { description: 'valid email', type: 'string', 'format': 'email' },
  tags: {
    type: 'array',
    'default': [],
    items: {
      type: 'string', 'minLength': 3, 'maxLength': 50
    }
  },
  password: {
    description: 'Minimum 6 characters at least 1 Uppercase Alphabet, 1 Lowercase Alphabet and 1 Number',
    type: 'string',
    pattern: '^[a-zA-Z0-9_#?!@$%^&*-]{6,30}$'
  },
  confirmPassword: {
    type: 'string'
  },
  pics: {
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: { sizes: { type: 'object' }, picId: { type: 'string' } },
      required: ['picId', 'sizes']
    }
  },
  deleted: { type: 'boolean' },
  VIEW_META: {
    updated: { type: 'number' },
    created: { type: 'number' },
    is_test: { type: 'boolean' },
    FU_META: { type: 'object' }
  },
  options: { type: 'object' },
  notifications: { type: 'object' },
  emailConfirmationCode: {
    type: 'string',
    description: 'emailConfirmationCode in format UUID v4',
    pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
  }
}

var defaultResponseSchema = {
  additionalProperties: false,
  properties: {
    __RESULT_TYPE__: { type: 'string' },
    error: { type: 'string' },
    errorType: { type: 'string' },
    errorData: { type: 'object' },
    success: { type: 'string' },
    data: { type: 'object' },
    view: { additionalProperties: false, type: 'object', properties: entitySchemaProperties },
    id: { type: 'string' },
    partial: { type: 'boolean' },
    mutations: {
      type: 'array',
      items: {
        additionalProperties: false,
        type: 'object',
        properties: {
          mutation: { type: 'string' },
          version: { type: 'string' },
          data: { type: 'object' }
        }
      }
    }
  }
  // 'additionalProperties': true
}

// const getToken = async function (id, meta, jwt, permissions) {
//   // var permissions = await netClient.emit('getPermissions', { id }, meta)
//   return auth.createToken(id, permissions, meta, CONFIG.jwt)
//  }
const getUserByMail = async function (email, filterGuest = true) {
  try {
    var results
    if (filterGuest)results = await DB.query('SELECT item.* FROM users item WHERE DOC_TYPE="view" AND email=$1 LIMIT 1', [email], true)
    else results = await DB.query('SELECT item.* FROM users item WHERE DOC_TYPE="view" AND email=$1 and guest IS MISSING OR guest=false LIMIT 1', [email], true)
    debug('getUserByMail', results, email)
    if (!results || !results[0]) return null
    else return results[0]
  } catch (error) { throw new Error('problems during getUserByMail ' + error) }
}

const getView = (id, fields) => fields ? DB.getPartial(id, fields) : DB.get(id)
const mutate = (id, mutation, meta, data) => {
  var mutationInfo = mutationsPack.mutate({ data, objId: id, mutation, meta })
  var mutationInfoCopy = Object.assign({ }, mutationInfo)
  delete mutationInfoCopy.meta
  netClient.emit('mutation', mutationInfoCopy)
  return mutationInfo
}
const saveMutationsAndUpdateView = async function (id, mutations, view, meta) {
  // try {
  DB.upsertMulti('mutation', mutations)
  var timestamp = mutations[0].timestamp
  if (!view) view = await getView(id)
  if (!view) view = { }
  view.VIEW_META = view.VIEW_META || { }
  view.VIEW_META.updated = timestamp
  view.VIEW_META.created = view.VIEW_META.created || timestamp
  if (meta && meta.is_test) view.VIEW_META.is_test = true
  view.META = meta
  log('view', view)
  var updatedView = mutationsPack.applyMutations(view, mutations)

  // FIELDS UPDATE META
  updatedView.VIEW_META.FU_META = updatedView.VIEW_META.FU_META || { }
//   for (var mutation of mutations) {
//     log('serviceInfo.mutations', serviceInfo.mutations)
//     var info = serviceInfo.mutations[mutation.mutation + '.' + mutation.version + '.js']
//     log('serviceInfo.mutations info', info)
//     if (info.fieldsWrite === '*') {
//       for (var fieldName in updatedView) {
//         if (fieldName !== 'VIEW_META') updatedView.VIEW_META.FU_META[fieldName] = timestamp
//       }
//     } else {
//       for (var fieldName of info.fieldsWrite) updatedView.VIEW_META.FU_META[fieldName] = timestamp
//     }
// // MutationsInfo
// // MutationsInfo
//   }
  for (var fieldName in updatedView) {
    if (JSON.stringify(view[fieldName]) !== JSON.stringify(updatedView[fieldName]))updatedView.VIEW_META.FU_META[fieldName] = timestamp
  }
  log('updatedView', updatedView)
  await DB.put('view', updatedView, id)
  delete updatedView.emailConfirmationCode
  delete updatedView.password
  return updatedView
  //  } catch (error) {
  //   errorLog('problems during saveMutationsAndUpdateView ' + error, error)
  //   throw new Error('problems during saveMutationsAndUpdateView ' + error)
  //  }
}
var getTokenData = async function (meta = { }) {
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
  var permissionsArray = tokenData.permissions || []
  var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, { [currentValue]: true }), { })
  log('getTokenData', { meta, userId, tokenData, permissionsArray, permissions })
  return { userId, tokenData, permissionsArray, permissions }
}

var serviceAutotest = async function (reqData, meta, getStream) {
  var errors = []
  var testId = uuidv4()

  // getUserByMail
  debug('autotest start ', testId)
  try {
    var MutationsInfo = mutationsPack.getMutationsInfo()
    if (!MutationsInfo) throw new Error('MutationsInfo is empty')
  } catch (error) {
    errors.push({ test: 'MutationsInfo', error, errorMsg: error.msg })
  }

  try {
    var email = testId + '@' + testId + '.com'
    await DB.put('view', { id: testId, email, is_test: true })
    await new Promise((resolve) => setTimeout(resolve, 1000))
    var userByMail = await getUserByMail(email)
    await DB.remove(testId)
    if (!userByMail) throw new Error('inserted user is not founded by getUserByMail')
  } catch (error) {
    errors.push({ test: 'getUserByMail', error, errorMsg: error.msg })
  }

  if (errors.length) {
    var testResults = { testId, error: 'test errors', data: errors }
    errorLog('autotest error ', testResults)
    return testResults
  }
  debug('autotest success ', testId)
  return { testId, success: 'all tests passed!' }
}

var serviceStarted = false
var serviceInfo = false
var autotestResults = false

// -----------------------------------------------------------------
// const EventEmitter = require('events')
// class MicroserviceEventEmitter extends EventEmitter {  }
// var microserviceEventEmitter = new MicroserviceEventEmitter()
var getServiceInfo = async function () {
  // log('serviceMethods', serviceMethods)
  var schemaOut = { }
  for (let i in serviceMethods) if (serviceMethods[i].config && serviceMethods[i].config.public) schemaOut[i] = serviceMethods[i].request

  var mutations = { }
  require('fs').readdirSync(path.join(__dirname, '/mutations')).forEach(function (file, index) {
    var mutation = require(path.join(__dirname, '/mutations/', file))
    if (mutation && mutation.exec)mutations[file] = Object.assign({ }, mutation, { exec: mutation.exec.toString() })
  })

  var liveQueries = { }
  for (let i in serviceMethods) if (serviceMethods[i].config && serviceMethods[i].config.query && serviceMethods[i].liveQueryUpdate) liveQueries[i] = serviceMethods[i].liveQueryUpdate.toString()

  return { schema: schemaOut, mutations, liveQueries }
}

var serviceMethods = {
  init: async function (setNetClient) {
    serviceInfo = await getServiceInfo()
    netClient = setNetClient

    var sharedMethods = require('sint-bit-utils/utils/sharedMethods')
    await sharedMethods.init(netClient, serviceMethods)
    for (var i in sharedMethods)serviceMethods[i] = sharedMethods[i]

    await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
      // await DB.createIndex('views', ['dashId', 'userId'])
    await DB.createIndex(['email'])
    await DB.createIndex(['guest'])
    await DB.createIndex(['VIEW_META.updated'])
    await DB.createIndex(['DOC_TYPE'])

    autotestResults = await serviceAutotest()
    setInterval(async arg => { autotestResults = await serviceAutotest() }, 600000)
    serviceStarted = true
    return true
  },
  autotest: {
    config: { public: false, stream: false, upload: false },
    exec: serviceAutotest
  },
  status: {
    config: { public: false, stream: false, upload: false },
    exec: async function (reqData, meta, getStream) {
      var result = { data: { serviceStarted, autotestResults } }
      if (serviceStarted && autotestResults.success) {
        result.success = 'service status ok'
      } else {
        result.error = 'service can have some problems'
      }
      return result
    }
  },
  serviceInfo: {
    config: { public: true, stream: false, upload: false },
    request: { },
    response: { properties: { 'schema': { type: 'object' }, 'mutations': { type: 'object' }, 'liveQueries': { type: 'object' } } },
    exec: getServiceInfo

  },
  // getEvents: {
  //   config: { public: true, stream: true, upload: false },
  //   request: { properties: { 'type': { type: 'string' }, 'service': { type: 'string' } } },
  //   response: false,
  //   exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
  //     var stream = getStream()
  //     var listener = (event) => {
  //       try {  stream.write(event)  } catch (err) {
  //         stream.end(event)
  //         netClient.off(reqData.type, listener)
  //        }
  //      }
  //     netClient.on(reqData.type, listener, reqData.service)
  //    }
  //
  //  },

  rawMutate: {
    config: { public: false, stream: false, upload: false },
    request: { properties: { id: entitySchemaProperties.id, mutation: { type: 'string' }, data: { type: 'object' } }, required: [ 'mutation', 'data' ] },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      debug('rawMutate', reqData)
      if (!reqData.id)reqData.id = reqData.data.id = itemId(reqData.data)
      var id = reqData.id
      debug('rawMutate', id)
      var mutation = mutate(reqData.id, reqData.mutation, meta, reqData.data)
      log('rawMutate mutation', mutation)
      var view = await saveMutationsAndUpdateView(reqData.id, [mutation], null, meta)
      log('rawMutate view', view)
      return { success: `User created`, id, view, mutations: [mutation] }
    } },
  create: {
    config: { public: true, stream: false, upload: false },
    request: { properties: entitySchemaProperties, required: [ 'email', 'password', 'confirmPassword' ] },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      debug('create', { reqData })
      if (reqData.password !== reqData.confirmPassword) throw new Error('Confirm Password not equal')
      reqData.password = require('bcrypt').hashSync(reqData.password, 10)
      var currentState = await getUserByMail(reqData.email)
      if (currentState) throw new Error('Users exists')
      reqData.emailConfirmationCode = uuidv4()
      var id = reqData.id = itemId(reqData)
      // var tokenData = await getTokenData(meta)
      var mutation = mutate(id, 'create', meta, reqData)
      var view = await saveMutationsAndUpdateView(id, [mutation], null, meta)
      EMAIL.sendMail({ from: CONFIG.smtp.from, to: reqData.email, template: { text: '${ emailConfirmationCode }', html: '${ emailConfirmationCode }', subject: 'Confirm your email' }, templateData: reqData }, CONFIG.smtp)
      await netClient.emit('USER_CREATED', { view }, meta)
      return { success: `User created`, id, mutations: [mutation] }
    } },
  readEmailConfirmationCode: {
    config: { public: false, stream: false, upload: false },
    request: { properties: { id: entitySchemaProperties.id }, required: [ 'id' ] },
    response: { properties: { emailConfirmationCode: entitySchemaProperties.emailConfirmationCode } },
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      debug('create', { reqData })
      var id = reqData.id
      var view = await getView(id)
      return { emailConfirmationCode: view.emailConfirmationCode }
    } },
  refreshToken: {
    config: { public: true, stream: false, upload: false },
    request: { },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var token = await auth.refreshToken(meta.token, CONFIG.jwt)
      return { success: `New token generated`, data: { token } }
    } },
  confirmEmail: {
    config: { public: true, stream: false, upload: false },
    request: {
      properties: { email: entitySchemaProperties.email, emailConfirmationCode: entitySchemaProperties.emailConfirmationCode },
      required: [ 'email', 'emailConfirmationCode' ]
    },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var currentState = await getUserByMail(reqData.email)
      if (!currentState) throw new Error('email is confirmed or user is not registered')
      if (currentState.emailConfirmationCode !== reqData.emailConfirmationCode) throw new Error('email confirmation code not valid')
      var id = currentState.id
      var data = { }
      var mutation = mutate(id, 'confirmEmail', meta, data)
      var view = await saveMutationsAndUpdateView(id, [mutation], currentState, meta)
      return { success: `Email confirmed`, id, mutations: [mutation] }
    } },
  // assignPassword: {
  //   config: { public: true, stream: false, upload: false },
  //   request: {
  //     properties: {  email: entitySchemaProperties.email, password: entitySchemaProperties.password, confirmPassword: entitySchemaProperties.password  },
  //     required: [ 'email', 'password', 'confirmPassword' ]
  //    },
  //   response: defaultResponseSchema,
  //   exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
  //     if (reqData.password !== reqData.confirmPassword) throw new Error('Confirm Password not equal')
  //     var currentState = await getUserByMail(reqData.email)
  //     debug('assignPassword', currentState)
  //     if (!currentState || currentState.deleted || currentState.passwordAssigned || !currentState.emailConfirmed) throw new Error('problems during assignPassword')
  //     var id = currentState.id
  //     var data = { password: require('bcrypt').hashSync(reqData.password, 10) }
  //     var mutation = mutate(id, 'assignPassword', meta, data)
  //     var view = await saveMutationsAndUpdateView(id, [mutation], currentState, meta)
  //     return { success: `Password assigned`, id, mutations: [mutation] }
  //    } },
  login: {
    config: { public: true, stream: false, upload: false },
    request: {
      properties: { email: entitySchemaProperties.email, password: entitySchemaProperties.password },
      required: [ 'email', 'password' ]
    },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var bcrypt = require('bcrypt')
      var currentState = await getUserByMail(reqData.email)
      if (!currentState || !currentState.emailConfirmed) throw new Error('Wrong username or password')
      if (!bcrypt.compareSync(reqData.password, currentState.password)) throw new Error('Wrong username or password')
      delete reqData.password
      var id = currentState.id
      var token = await auth.createToken(id, { permissions: currentState.permissions || [] }, CONFIG.jwt)
      var data = { token }
      var mutation = mutate(id, 'login', meta, data)
      var view = await saveMutationsAndUpdateView(id, [mutation], currentState, meta)
      return { success: `Logged In`, id, view, data: { token } }
    } },
  updatePersonalInfo: {
    config: { public: true, stream: false, upload: false },
    request: { properties: { id: entitySchemaProperties.id, firstName: entitySchemaProperties.firstName, lastName: entitySchemaProperties.lastName, birth: entitySchemaProperties.birth, publicName: entitySchemaProperties.publicName }, required: [ 'id' ] },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var id = reqData.id
      var currentState = await getView(id)
      var tokenData = await getTokenData(meta)
      log('tokenData', tokenData)
      if (!currentState || currentState.deleted || !currentState.emailConfirmed) throw new Error('problems during updatePersonalInfo')
      if (!tokenData.permissions['usersWrite'] && currentState.id !== tokenData.userId) throw new Error('user cant write for other users')
      var data = reqData
      var mutation = mutate(id, 'updatePersonalInfo', meta, data)
      var view = await saveMutationsAndUpdateView(id, [mutation], currentState, meta)
      return { success: `Personal Info updated`, id, view, mutations: [mutation] }
    } },

  addPic: {
    config: { public: true, stream: false, upload: { fields: [{ name: 'pic', maxCount: 1 }] } },
    request: false,
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      log('addPic', reqData)
      const picLib = require('sint-bit-utils/utils/pic')
      var id = reqData.id
      var currentState = await getView(id)
      var tokenData = await getTokenData(meta)
      if (!currentState || currentState.deleted || !currentState.emailConfirmed) throw new Error('problems during updatePersonalInfo')
      if (!tokenData.permissions['usersWrite'] && currentState.id !== tokenData.userId) throw new Error('user cant write for other users')
      var picId = uuidv4()

      var picBuffers = await picLib.resizeAndGetBuffers(reqData.pic, [['mini', 100, 100]])
      var picData = { picId, sizes: { } }
      for (var size in picBuffers) {
        var picSizeId = uuidv4()
        picData.sizes[size] = picSizeId
        await DB.put('pic', picBuffers[size], picSizeId)
      }
      var picMeta = { id: picId, userId: id, sizes: picData.sizes }
      if (meta.is_test)picMeta.is_test = true
      await DB.put('picMeta', picMeta, picId + '_meta')

      var data = { pic: picData }
      var mutation = mutate(currentState.id, 'addPic', meta, data)
      var view = await saveMutationsAndUpdateView(currentState.id, [mutation], currentState, meta)
      return { success: `Pic Added`, id, data: picData, view, mutations: [mutation] }
    } },
  getPic: {
    config: { public: true, stream: false, upload: false },
    request: { properties: { 'id': entitySchemaProperties.id, 'size': { type: 'string' } } },
    response: false,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var picMeta = await DB.get(reqData.id + '_meta')
      if (!picMeta || picMeta.deleted) throw new Error('problems with picMeta')
      var currentState = await getView(picMeta.userId)
      if (!currentState || currentState.deleted || !currentState.emailConfirmed) throw new Error('problems during getPic')
      if (!picMeta.sizes || !picMeta.sizes[reqData.size]) throw new Error('problems with picSizeId')
      var picSizeId = picMeta.sizes[reqData.size]
      var pic = await DB.get(picSizeId)
      // log('picSizeId', { picSizeId, pic: pic })
      return pic
    // return await pic.getPic(aerospikeConfig, kvDbClient, reqData.id, reqData.size || 'mini')
    } },
  deletePic: {
    config: { public: true, stream: false, upload: false },
    request: { properties: { id: entitySchemaProperties.id }, required: [ 'id' ] },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var picMeta = await DB.get(reqData.id + '_meta')
      if (!picMeta || picMeta.deleted) throw new Error('problems with picMeta')

      var currentState = await getView(picMeta.userId)
      var tokenData = await getTokenData(meta)
      if (!currentState || currentState.deleted || !currentState.emailConfirmed) throw new Error('problems during updatePersonalInfo')
      if (!tokenData.permissions['usersWrite'] && currentState.id !== tokenData.userId) throw new Error('user cant write for other users')
      var data = { picId: reqData.id }
      var mutation = mutate(currentState.id, 'deletePic', meta, data)
      var view = await saveMutationsAndUpdateView(currentState.id, [mutation], currentState, meta)
      picMeta.deleted = true
      await DB.put('picMeta', picMeta, reqData.id + '_meta')
      return { success: `Pic Deleted`, id: reqData.id, data: picMeta, mutations: [mutation] }
    } },
  changePassword: {
    config: { public: true, stream: false, upload: false },
    request: { properties: { id: entitySchemaProperties.id, password: entitySchemaProperties.password, oldPassword: entitySchemaProperties.password, confirmPassword: entitySchemaProperties.password } },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var bcrypt = require('bcrypt')
      var id = reqData.id
      var currentState = await getView(id)
      var tokenData = await getTokenData(meta)
      if (reqData.password !== reqData.confirmPassword) throw new Error('Confirm Password not equal')
      if (currentState.password && !bcrypt.compareSync(reqData.oldPassword, currentState.password)) throw new Error('Old Password not valid')
      if (!currentState || currentState.deleted || !currentState.emailConfirmed) throw new Error('entity state problems (not present, deleted or not ready)')
      if (!tokenData.permissions['usersWrite'] && currentState.id !== tokenData.userId) throw new Error('user cant write for other users')
      var data = { password: bcrypt.hashSync(reqData.password, 10) }
      var mutation = mutate(currentState.id, 'changePassword', meta, data)
      var view = await saveMutationsAndUpdateView(currentState.id, [mutation], currentState, meta)
      return { success: `Password updated`, id: reqData.id, mutations: [mutation] }
    } },
  createGuest: {
    config: { public: true, stream: false, upload: false },
    request: {
      properties: { publicName: entitySchemaProperties.name, email: entitySchemaProperties.email, info: { type: 'object' } },
      required: [ 'email', 'publicName' ]
    },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      log('createGuest', reqData)
      var mailExists = await getUserByMail(reqData.email)
      if (mailExists) throw new Error('User mail exists')
      var id = uuidv4()
      var password = uuidv4()
      var data = { id: reqData.id, info: reqData.info, email: reqData.email, password: require('bcrypt').hashSync(password, 10) }
      var mutation = mutate(id, 'createGuest', meta, data)
      var view = await saveMutationsAndUpdateView(id, [mutation], { }, meta)
      var token = await auth.createToken(id, { permissions: [], guest: true }, CONFIG.jwt)
      return { success: `Guest User created`, id, view, mutations: [mutation], data: { token, password } }
    } },
  update: {
    config: { public: true, stream: false, upload: false },
    request: { properties: entitySchemaProperties, required: [ 'id' ] },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var id = reqData.id
      var currentState = await getView(id)
      var tokenData = await getTokenData(meta)
      if (!currentState || currentState.deleted || !currentState.emailConfirmed) throw new Error('entity state problems (not present, deleted or not ready)')
      if (!tokenData.permissions['usersWrite'] && currentState.id !== tokenData.userId) throw new Error('user cant write for other users')
      var data = reqData
      var mutation = mutate(id, 'update', meta, data)
      var view = await saveMutationsAndUpdateView(id, [mutation], currentState, meta)
      return { success: `User updated`, id, mutations: [mutation] }
    } },
  read: {
    config: { public: true, stream: false, upload: false, query: true, singleResult: true },
    request: { properties: { id: entitySchemaProperties.id, fields: { type: 'array', item: { type: 'string' } } }, required: [ 'id' ] },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var id = reqData.id
      var tokenData = await getTokenData(meta)
      if (!tokenData.permissions['usersReadAll'] && id !== tokenData.userId) reqData.fields = ['VIEW_META', 'id', 'publicName', 'deleted', 'emailConfirmed']
      log('read', { id, fields: reqData.fields })
      var currentState = await getView(id, reqData.fields)
      log('read', { reqData, currentState })
      if (!currentState) throw new Error('entity state problems (not present, deleted or not ready)')
      if ((!tokenData.permissions['usersReadAll'] && id !== tokenData.userId) && (currentState.deleted || !currentState.emailConfirmed)) throw new Error('entity state problems (not present, deleted or not ready)')
      // if (!tokenData.permissions['usersReadAll'] && id !== tokenData.userId) throw new Error('user cant read  other users')
      if (currentState.emailConfirmationCode) delete currentState.emailConfirmationCode
      if (currentState.password) delete currentState.password
      return { success: `User readed`, id, view: currentState, partial: !!reqData.fields }
    } },
  delete: {
    config: { public: true, stream: false, upload: false },
    request: { properties: { id: entitySchemaProperties.id }, required: [ 'id' ] },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var id = reqData.id
      var currentState = await getView(id)
      var tokenData = await getTokenData(meta)
      if (!currentState || currentState.deleted || !currentState.emailConfirmed) throw new Error('entity state problems (not present, deleted or not ready)')
      if (!tokenData.permissions['usersWrite'] && currentState.id !== tokenData.userId) throw new Error('user cant write for other users')
      var data = { }
      var mutation = mutate(id, 'delete', meta, data)
      var view = await saveMutationsAndUpdateView(id, [mutation], currentState, meta)
      return { success: `User deleted`, id, mutations: [mutation] }
    } },
  addTags: {
    config: { public: true, stream: false, upload: false },
    request: { properties: { id: entitySchemaProperties.id, tags: entitySchemaProperties.tags }, required: [ 'id' ] },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var id = reqData.id
      var currentState = await getView(id)
      var tokenData = await getTokenData(meta)
      if (!currentState || currentState.deleted || !currentState.emailConfirmed) throw new Error('entity state problems (not present, deleted or not ready)')
      if (!tokenData.permissions['usersWrite'] && currentState.id !== tokenData.userId) throw new Error('user cant write for other users')
      var data = { tags: reqData.tags }
      var mutation = mutate(id, 'addTags', meta, data)
      var view = await saveMutationsAndUpdateView(id, [mutation], currentState, meta)
      return { success: `Tags added`, id, mutations: [mutation] }
    } },
  removeTags: {
    config: { public: true, stream: false, upload: false },
    request: { properties: { id: entitySchemaProperties.id, tags: entitySchemaProperties.tags }, required: [ 'id' ] },
    response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var id = reqData.id
      var currentState = await getView(id)
      var tokenData = await getTokenData(meta)
      if (!currentState || currentState.deleted || !currentState.emailConfirmed) throw new Error('entity state problems (not present, deleted or not ready)')
      if (!tokenData.permissions['usersWrite'] && currentState.id !== tokenData.userId) throw new Error('user cant write for other users')
      var data = { tags: reqData.tags }
      var mutation = mutate(id, 'removeTags', meta, data)
      var view = await saveMutationsAndUpdateView(id, [mutation], currentState, meta)
      return { success: `Tags removed`, id, mutations: [mutation] }
    } },
  // list: {
  //   config: { public: true, stream: false, upload: false },
  //   request: {  properties: {  from: {  type: 'integer'  }, to: {  type: 'integer'  }, loadIfUpdatedAfter: {  type: 'integer'  }, fields: { type: 'array', item: { type: 'string' } }  }  },
  //   response: { properties: { results: { type: 'array', items: entitySchemaProperties }, errors: { type: 'array' } } },
  //   // request: { properties: { 'type': { type: 'string' } } },
  //   // response: defaultResponseSchema,
  //   exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
  //     var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  //     var tokenData = await getTokenData(meta)
  //     // reqData.loadIfUpdatedAfter
  //     var fields = reqData.fields || false
  //     var offset = reqData.from || 0
  //     var limit = reqData.to || 20 - offset
  //     var queryFields = fields ? fields.map(field => 'item.' + field).join(',') : reqData.loadIfUpdatedAfter ? '  item ' : '  item.* '
  //     var querySelect = reqData.loadIfUpdatedAfter ? ' SELECT CASE WHEN VIEW_META.updated>' + reqData.loadIfUpdatedAfter + ' THEN ' + queryFields + ' ELSE id END ' : ' SELECT ' + queryFields
  //     var queryFrom = ' FROM users item '
  //     var queryWhere = ' where DOC_TYPE="view" '
  //     if (!tokenData.permissions['usersReadAll'])queryWhere += ' AND (item.id=$1 OR ((item.deleted IS MISSING OR item.deleted=false) )) '
  //     var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $2 OFFSET $3 '
  //     var results = await DB.query(querySelect + queryFrom + queryWhere + queryOrderAndLimit, [userId, limit, offset])
  //     if (reqData.loadIfUpdatedAfter)results = results.map(result => result['$1'])
  //     debug('list results', results)
  //     return { success: `entities listed`, results }
  //    }
  //  },
  lastUpdated: {
    config: { public: true, stream: false, upload: false, query: true, singleResult: true },
    liveQueryUpdate: (mutation, query) => { return mutation.mutation === 'confirmEmail' || mutation.mutation === 'remove' },
    request: { properties: { from: { type: 'integer' }, to: { type: 'integer' }, idsOnly: { type: 'boolean' }, fields: { type: 'array', item: { type: 'string' } } } },
    response: { properties: { success: { type: 'string' }, results: { type: 'array', items: entitySchemaProperties }, ids: { type: 'array', items: { type: 'string' } }, timestamp: { type: 'integer' }, errors: { type: 'array' } } },
    // request: { properties: { 'type': { type: 'string' } } },
    // response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
      var tokenData = await getTokenData(meta)
      // var offset = reqData.from || 0
      // var limit = reqData.to || 20 - offset
      // var queryBody = ' where DOC_TYPE="view" '
      // if (!tokenData.permissions['usersReadAll'])queryBody += ' AND (item.id=$1 OR ((item.deleted IS MISSING OR item.deleted=false) )) '
      // queryBody += ' ORDER BY item.VIEW_META.updated DESC LIMIT $2 OFFSET $3 '
      // var results = await DB.queryIdIfModifiedBefore(reqData.loadIfUpdatedAfter, reqData.fields, queryBody, [userId, limit, offset])

      // reqData.loadIfUpdatedAfter
      var fields = reqData.fields || false
      // if (!tokenData.permissions['usersReadAll'])fields = ['id', 'publicName', 'VIEW_META']
      var offset = reqData.from || 0
      var limit = reqData.to || 20 - offset
      var queryFields = reqData.idsOnly ? ' item.id ' : fields ? fields.map(field => 'item.' + field).join(',') : '  item.* '
      var querySelect = ' SELECT ' + queryFields
      var queryFrom = ' FROM users item '
      var queryWhere = ' where DOC_TYPE="view" '
      if (!tokenData.permissions['usersReadAll'])queryWhere += ' AND (item.id=$1 OR ((item.deleted IS MISSING OR item.deleted=false) AND (item.emailConfirmed=true) )) '
      var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $2 OFFSET $3 '
      var results = await DB.query(querySelect + queryFrom + queryWhere + queryOrderAndLimit, [userId, limit, offset])
      log('list results', results)
      if (reqData.idsOnly) return { success: `entities listed`, ids: results.map(result => result['id']), timestamp: Date.now() }
      return { success: `entities listed`, results, timestamp: Date.now() }
    }
  },
  list: {
    config: { public: true, stream: false, upload: false, query: true, singleResult: true },
    liveQueryUpdate: (mutation, query) => { return mutation.mutation === 'create' || mutation.mutation === 'remove' },
    request: { properties: { from: { type: 'integer' }, to: { type: 'integer' }, loadIfUpdatedAfter: { type: 'integer' }, fields: { type: 'array', item: { type: 'string' } } } },
    response: { properties: { success: { type: 'string' }, results: { type: 'array', items: entitySchemaProperties }, timestamp: { type: 'integer' }, errors: { type: 'array' } } },
    // request: { properties: { 'type': { type: 'string' } } },
    // response: defaultResponseSchema,
    exec: async function (reqData, meta = { directCall: true, is_test: false }, getStream = null) {
      var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
      var tokenData = await getTokenData(meta)
      // var offset = reqData.from || 0
      // var limit = reqData.to || 20 - offset
      // var queryBody = ' where DOC_TYPE="view" '
      // if (!tokenData.permissions['usersReadAll'])queryBody += ' AND (item.id=$1 OR ((item.deleted IS MISSING OR item.deleted=false) )) '
      // queryBody += ' ORDER BY item.VIEW_META.updated DESC LIMIT $2 OFFSET $3 '
      // var results = await DB.queryIdIfModifiedBefore(reqData.loadIfUpdatedAfter, reqData.fields, queryBody, [userId, limit, offset])

      // reqData.loadIfUpdatedAfter
      var fields = reqData.fields || false
      // if (!tokenData.permissions['usersReadAll'])fields = ['id', 'publicName', 'VIEW_META']
      var offset = reqData.from || 0
      var limit = reqData.to || 20 - offset
      var queryFields = fields ? fields.map(field => 'item.' + field).join(',') : reqData.loadIfUpdatedAfter ? '  item ' : '  item.* '
      var querySelect = reqData.loadIfUpdatedAfter ? ' SELECT CASE WHEN VIEW_META.updated>' + reqData.loadIfUpdatedAfter + ' THEN ' + queryFields + ' ELSE id END ' : ' SELECT ' + queryFields
      var queryFrom = ' FROM users item '
      var queryWhere = ' where DOC_TYPE="view" '
      if (!tokenData.permissions['usersReadAll'])queryWhere += ' AND (item.id=$1 OR ((item.deleted IS MISSING OR item.deleted=false) AND (item.emailConfirmed=true) )) '
      var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $2 OFFSET $3 '
      var results = await DB.query(querySelect + queryFrom + queryWhere + queryOrderAndLimit, [userId, limit, offset])
      if (reqData.loadIfUpdatedAfter)results = results.map(result => result['$1'])
      debug('list results', results)
      return { success: `entities listed`, results, timestamp: Date.now() }
    }
  }
}

module.exports = serviceMethods
