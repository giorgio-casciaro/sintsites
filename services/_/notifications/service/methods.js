const path = require('path')
const uuidv4 = require('uuid/v4')
const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
var CONFIG = require('./config')
var mutationsPack = require('sint-bit-cqrs/mutations')({ mutationsPath: path.join(__dirname, '/mutations') })
const auth = require('sint-bit-utils/utils/auth')
var netClient

const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'MAIN', msg, data])) }
const debug = (msg, data) => { if (process.env.debugMain)console.log('\n' + JSON.stringify(['DEBUG', 'MAIN', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'MAIN', msg, data])); console.error(data) }

const arrayToObjBy = (array, prop) => array.reduce((newObj, item) => { newObj[item[prop]] = item; return newObj }, {})

var resultsError = (item, msg) => { return {id: item.id || 'unknow', __RESULT_TYPE__: 'error', error: msg} }
var queueObj = require('sint-bit-utils/utils/queueObj')(resultsError)

var itemId = (item) => uuidv4()

var rpcUsersRawReadMulti = (ids, meta) => netClient.rpcCall({to: 'users', method: 'rawReadMulti', data: {ids}, meta})
var usersRawReadMulti = async(ids, meta) => {
  var response = await rpcUsersRawReadMulti(ids, meta)
  return response.results
}
var rpcEmailsAddToQueueMulti = (data, meta) => netClient.rpcCall({to: 'emails', method: 'addToQueueMulti', data, meta})
var emailsAddToQueueMulti = async(data, meta) => {
  var response = await rpcEmailsAddToQueueMulti(data, meta)
  debug('rpcEmailsAddToQueueMulti', response)
  return response.results
}
var rpcEmailsRegisterTemplates = (data, meta) => netClient.rpcCall({to: 'emails', method: 'registerTemplates', data, meta})
var emailsRegisterTemplates = async(data, meta) => {
  var response = await rpcEmailsRegisterTemplates(data, meta)
  debug('rpcEmailsRegisterTemplates', response)
  return response.results
}

// -----------------------------------------------------------------

const updateViews = async function (mutations, views) {
  try {
    if (!views) {
      var ids = mutations.map((mutation) => mutation.objId)
      views = await getViews(ids)
    }
    views = views.map((view) => view || {})
    var viewsById = arrayToObjBy(views, 'id')
    var viewsToUpdate = []
    debug('updateViews', { views, mutations })
    mutations.forEach((mutation, index) => {
      var view = viewsById[mutation.objId] || {}
      view.VIEW_META = view.VIEW_META || {}
      view.VIEW_META.updated = Date.now()
      view.VIEW_META.created = view.VIEW_META.created || Date.now()
      viewsById[mutation.objId] = mutationsPack.applyMutations(view, [mutation])
      viewsToUpdate.push(viewsById[mutation.objId])
    })
    var results = await DB.upsertMulti('view', viewsToUpdate)
    debug('updateViews results', results)
    if (!results) return null
    results = results.map((result, index) => Object.assign(result, { mutation: mutations[index].name }))
    results.forEach((result, index) => {
      if (result.error) return null
      var mutation = mutations[index]
      // var view = viewsById[mutation.objId]
      // netClient.emit('NOTIFICATIONS_ENTITY_MUTATION', { id: result.id, mutation })//, dashId: view.dashId, toTags: view.toTags, toRoles: view.toRoles
    })
    return results
  } catch (error) { throw new Error('problems during updateViews ' + error) }
}
const mutateAndUpdate = async function (mutation, dataToResolve, meta, views) {
  try {
    debug('mutateAndUpdate', {mutation, dataToResolve, views})
    var mutations = dataToResolve.map((mutationAndData) => mutationsPack.mutate({data: mutationAndData.data, objId: mutationAndData.id, mutation, meta}))
    // DB.upsertMulti('mutation', mutations)
    return await updateViews(mutations, views)
  } catch (error) { throw new Error('problems during mutateAndUpdate ' + error) }
}

const getViews = async (ids, select = '*', guest = false) => {
  if (typeof ids !== 'object') { ids = [ids]; var single = true }
  var views = await DB.getMulti(ids)
  if (single) return views[0]
  else return views
}

// var linkedSubscriptions = async function (idsOrItems, meta, userId, permissionsToCheck) {
//   if (!Array.isArray(idsOrItems)) { idsOrItems = [idsOrItems]; var single = true }
//   var dashIds = idsOrItems.filter(value => value).map(item => typeof item === 'object' ? item.dashId : item).filter((v, i, a) => a.indexOf(v) === i)
//   var items = dashIds.map((dashId) => ({dashId, userId}))
//   var subscriptions = await subscriptionsGetPermissions(items, meta)
//   var byDashId = arrayToObjBy(subscriptions, 'dashId')
//   var permissionsByDashId = {}
//   subscriptions.forEach((subscription) => {
//     // debug('linkedSubscriptions', subscription)
//     permissionsByDashId[subscription.dashId] = {}
//     subscription.permissions.forEach((item) => {
//       permissionsByDashId[subscription.dashId][item] = true
//     })
//   })
//   return single ? { dashId: dashIds[0], subscription: subscriptions[0], permissions: permissionsByDashId[dashIds[0]] } : { dashIds, byDashId, permissionsByDashId }
// }
// var subscriptionsGetPermissions = async (items, meta) => {
//   var response = await rpcSubscriptionsGetPermissions(items, meta)
//   return response.results
// }
// var rpcSubscriptionsGetPermissions = (items, meta) => netClient.rpcCall({to: 'subscriptions', method: 'getPermissions', data: {items}, meta})
var createMulti = async function (reqData, meta, getStream) {
  var ids = reqData.items.map(item => itemId(item))
  var notificationsSends = []
  // var byId = {}
  // var users = []
  var func = async (resultsQueue, data, currentState, userId, permissions) => {
    // byId[data.id] = data
    // notificationsSends.push({id: data.id, data, userId: data.userId})
    resultsQueue.add(data.id, data)
  }
  var response = await basicMutationRequestMulti({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'create', func, loadViews: false})
  notificationsSends = reqData.items.filter((notificationsSend, index) => response.results[index] && response.results[index].__RESULT_TYPE__ !== 'error')
  await sendToChannels(notificationsSends, meta)
  // var usersViews = await usersRawReadMulti(users)
  // var channelsQueue = {}
  // var usersViews = reqData.usersViews || await usersRawReadMulti(users, meta)
  // log('createMulti sendTo', {users, usersViews})
  //
  // response.results.forEach((result, index) => {
  //   if (result.__RESULT_TYPE__ !== 'error') {
  //     var notification = byId[result.id]
  //     var usersView = usersViews[index]
  //     var sendTo = []
  //     if (notification.sendTo) {
  //       sendTo = notification.sendTo
  //       delete notification.sendTo
  //     }
  //     log('createMulti sendTo', {sendTo, usersView})
  //     for (var i in sendTo) {
  //       var singleSendTo = sendTo[i]
  //       if (singleSendTo.channel === 'email' && (usersView.notifications.email)) {
  //         if (!channelsQueue[singleSendTo.channel])channelsQueue[singleSendTo.channel] = []
  //         channelsQueue[singleSendTo.channel].push(Object.assign({data: notification, email: usersView.email}, singleSendTo.options))
  //       }
  //     }
  //   }
  // })
  // if (channelsQueue.email && channelsQueue.email.length) var emailResponse = await emailsAddToQueueMulti({items: channelsQueue['email']}, meta)
  // log('createMulti channelsQueue', {emailResponse, channelsQueue})

  return response
}

var sendToChannels = async function (notificationsSends, meta) {
  var channelsQueue = {}
  var usersViews = await usersRawReadMulti(notificationsSends.map(notificationsSend => notificationsSend.userId), meta)
  var usersViewsById = arrayToObjBy(usersViews, 'id')
  log('sendToChannels', {notificationsSends, usersViews})

  notificationsSends.forEach((notification, index) => {
    var usersView = usersViewsById[notification.userId]
    log('sendToChannels forEach', {notification, usersView})
    if (notification.sendTo) {
      var sendTo = notification.sendTo
      delete notification.sendTo
      log('sendToChannels sendTo', {sendTo, usersView})
      for (var i in sendTo) {
        var singleSendTo = sendTo[i]
        if (singleSendTo.channel === 'email' && (usersView.notifications.email)) {
          if (!channelsQueue[singleSendTo.channel])channelsQueue[singleSendTo.channel] = []
          channelsQueue[singleSendTo.channel].push(Object.assign({data: notification, email: usersView.email}, singleSendTo.options))
        }
      }
    }
  })
  if (channelsQueue.email && channelsQueue.email.length) var emailResponse = await emailsAddToQueueMulti({items: channelsQueue['email']}, meta)
  var response = {channelsQueue, emailResponse}
  log('sendToChannels response', response)
  return response
}

var basicMutationRequestMulti = async function ({ids, dataArray, mutation, extend, meta, func, loadViews = true}) {
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
  // debug('basicMutationRequestMulti tokenData', {meta, jwt: CONFIG.jwt})
  var permissionsArray = tokenData.permissions || []
  var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
  if (extend)dataArray = dataArray.map(data => Object.assign(data, extend))
  var currentStates = loadViews ? await getViews(ids, '*', false) : []
  debug('basicMutationRequestMulti currentStates', {tokenData, currentStates, userId, permissionsArray})
  var resultsQueue = queueObj()
  for (var index in ids) {
    var data = dataArray[index] || {id: ids[index]}
    data.id = ids[index]
    var currentState = currentStates[index]
    await func(resultsQueue, data, currentState, userId, permissions)
  }
  await resultsQueue.resolve((dataToResolve) => mutateAndUpdate(mutation, dataToResolve, meta, currentStates))
  return resultsQueue.returnValue()
}
var basicMutationRequest = async function ({id, data, mutation, meta, func}) {
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
  var permissionsArray = tokenData.permissions || []
  var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
  debug('basicMutationRequest currentStates', {tokenData, permissions, userId, permissionsArray})
  var currentState = await getViews(id, '*', false)
  await func(data, currentState, userId, permissions)
  await mutateAndUpdate(mutation, [{id, data}], meta, [ currentState ])
}

module.exports = {
  deleteMulti: async function (reqData, meta, getStream) {
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Notifications not exists')
      debug('deleteMulti permissions', {id: currentState.id, userId, permissions})
      if (currentState.userId !== userId && !permissions['notificationsWrite']) {
        return resultsQueue.addError(data, `Notification ${userId} cant write notifications`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids: reqData.ids, extend: reqData.extend, dataArray: [], meta, mutation: 'delete', func})
  },
  confirmMulti: async function (reqData, meta, getStream) {
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Notifications not exists')
      debug('confirmMulti userId, permissions', { userId, permissions })
      if (!permissions['notificationsConfirm'] && !permissions['notificationsWrite']) {
        return resultsQueue.addError(data, `Notification ${userId} cant write notifications`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids: reqData.ids, extend: reqData.extend, dataArray: [], meta, mutation: 'confirm', func})
  },
  addTagsMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Notifications not exists')
      if (currentState.userId !== userId && !permissions['notificationsWrite']) {
        return resultsQueue.addError(data, `Notification ${userId} cant write notifications`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'addTags', func})
  },
  removeTagsMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Notifications not exists')
      if (currentState.userId !== userId && !permissions['notificationsWrite']) {
        return resultsQueue.addError(data, `Notification ${userId} cant write notifications`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'removeTags', func})
  },
  init: async function (setNetClient) {
    netClient = setNetClient
    log('CONFIG.couchbase', CONFIG.couchbase)
    await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
    await DB.createIndex(['objectType', 'objectId', 'userId'])
    await DB.createIndex(['DOC_TYPE'])
    await DB.createIndex(['VIEW_META'])
    var templates = []
    var templateBasePath = './templates/'
    var fs = require('fs')
    var path = require('path')
    require('fs').readdirSync(templateBasePath).forEach(subdir => {
      var template = {id: subdir}
      fs.readdirSync(path.join(templateBasePath, subdir)).forEach(file => {
        var clearName = file.split('.')[0]
        var contents = fs.readFileSync(path.join(templateBasePath, subdir, file)).toString()
        log('INIT templates', {contents, path: path.join(templateBasePath, subdir, file), clearName, templateBasePath, subdir, file})
        template[clearName] = contents
      })
      templates.push(template)
    })
    log('INIT templates', templates)

    var emailsRegisterTemplatesResp = await emailsRegisterTemplates({items: templates})
    log('INIT emailsRegisterTemplatesResp', emailsRegisterTemplatesResp)
  },
  rawMutateMulti: async function (reqData, meta, getStream) {
    if (reqData.extend)reqData.items.forEach(item => Object.assign(item.data, reqData.extend))
    reqData.items.forEach(item => { if (!item.id)item.id = item.data.id = itemId(item) })
    debug('rawMutateMulti reqData', reqData)
    var results = await mutateAndUpdate(reqData.mutation, reqData.items, meta)
    debug('rawMutateMulti', results)
    return {results}
  },
  createMulti,
  readMulti: async function (reqData, meta, getStream) {
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
    var permissionsArray = tokenData.permissions || []
    var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
    var currentStates = await getViews(reqData.ids, reqData.select || '*', false)
    var results = currentStates.map((currentState, index) => {
      if (!currentState) return resultsError({id: reqData.ids[index]}, 'Notification not exists')
      // var permissions = subscriptions.permissionsByDashId[currentState.dashId]
      // if (!permissions['notificationsRead']) return resultsError(currentState, 'Notification can\'t read notifications')
      if ((currentState.deleted || !currentState.confirmed) && !permissions['notificationsReadAll'] && currentState.userId !== userId) return resultsError(currentState, 'Notification cant read hidden notifications')
      return currentState
    })
    var errors = results.filter(value => value.__RESULT_TYPE__ === 'error').map((currentState, index) => index)
    debug('readMultireadMulti', {results, errors: errors.length ? errors : undefined})
    return {results, errors: errors.length ? errors : undefined}
  },
  updateMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Notifications not exists')
      // if (!permissions['notificationsWrite']) return resultsQueue.addError(currentState, userId + ' can\'t write notifications')
      debug('updateMulti permissions', permissions)
      if (currentState.userId !== userId && !permissions['notificationsWrite']) return resultsQueue.addError(currentState, currentState.dashId + ' ' + userId + ' can\'t write notifications for other notifications')
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'update', func})
  },
  list: async function (reqData, meta, getStream) {
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
    var permissionsArray = tokenData.permissions || []
    var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
    if (!permissions['notificationsList']) throw new Error('user cant list notifications')
    // var subscription = await linkedSubscriptions(dashId, meta, userId)
    // if (!subscription.permissions['notificationsRead']) { throw new Error('Cant read notifications from notification ' + dashId) }
    var select = reqData.select || false
    var offset = reqData.from || 0
    var limit = reqData.to || 20 - offset
    var querySelect = select ? ' SELECT ' + select.join(',') + ' FROM notifications ' : ' SELECT item.* FROM notifications item '
    var queryWhere = ' where  DOC_TYPE="view"  '
    if (!permissions['notificationsReadAll'])queryWhere += ' AND (item.id=$1 OR ((item.deleted IS MISSING OR item.deleted=false) )) '
    var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $2 OFFSET $3 '
    var results = await DB.query(querySelect + queryWhere + queryOrderAndLimit, [userId, limit, offset])
    debug('list results', results)
    return {results}
  },
  listByUserId: async function (reqData, meta, getStream) {
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
    var permissionsArray = tokenData.permissions || []
    var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
    if (userId !== reqData.userId && !permissions['notificationsList']) throw new Error('user cant list notifications')
    // var subscription = await linkedSubscriptions(dashId, meta, userId)
    // if (!subscription.permissions['notificationsRead']) { throw new Error('Cant read notifications from notification ' + dashId) }
    var select = reqData.select || false
    var offset = reqData.from || 0
    var limit = reqData.to || 20 - offset
    var querySelect = select ? ' SELECT ' + select.join(',') + ' FROM `notifications` ' : ' SELECT item.* FROM `notifications` item ' // OR ARRAY_LENGTH(ARRAY_INTERSECT(item.toTags,$4)) > 0 OR ARRAY_CONTAINS(item.toRoles,$5)
    var queryWhere = ' WHERE DOC_TYPE="view" AND userId=$1 '
    // var querySelect = select ? ' SELECT ' + select.join(',') + ' FROM notificationsViews ' : ' SELECT item.* FROM notificationsViews item '
    // var queryWhere = ' where userId=$1 '
    if (!permissions['notificationsReadAll'])queryWhere += ' AND (item.deleted IS MISSING OR item.deleted=false) '
    var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $2 OFFSET $3 '
    var results = await DB.query(querySelect + queryWhere + queryOrderAndLimit, [reqData.userId, limit, offset])
    debug('listByUserId results', results)
    return {results}
  },
  async readed (reqData, meta = {directCall: true}, getStream = null) {
    var id = reqData.id
    var func = (data, currentState, userId, permissions) => {
      if (!currentState) throw new Error('problems during set readed')
      if (!permissions['notificationsWrite'] && currentState.userId !== userId) throw new Error('user cant write for other users ' + userId + ' for ' + currentState.userId)
    }
    await basicMutationRequest({id, data: reqData, mutation: 'readed', meta, func})
    return {success: `Notification readed`}
  },
  postEvent: async function (reqData = {}, meta = {directCall: true}, getStream = null) {
    var notificationDefaults = { type: reqData.type, data: reqData.data, objectType: 'posts', objectId: reqData.objectId || '' }
    var notifications = reqData.users.map((userId) => ({ userId }))
    return createMulti({items: notifications, extend: notificationDefaults}, meta)
  },
  userEvent: async function (reqData = {}, meta = {directCall: true}, getStream = null) {
    log('userEvent reqData', {reqData, meta})
    // var notifications = reqData.users.map((userId) => ({ userId, type: 'USERS', data: {}, objectId: userId }))
    var notificationType = meta.emit
    // var notificationDefaults = { type: notificationType, data: {} }
    var sendTo = [{channel: 'email', options: {template: meta.emit}}]
    var notifications = reqData.results.map((data) => ({ type: notificationType, data, objectType: 'users', objectId: data.id, userId: data.id, sendTo }))
    log('userEvent notifications', {notifications})
    if (meta.emit === 'USERS_CREATED') { }
    // usersViews: reqData.results,
    return createMulti({ items: notifications }, meta)
  },
  async readedByObjectId (reqData, meta = {directCall: true}, getStream = null) {
    var objectId = reqData.objectId
    var objectType = reqData.objectType
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var results = await DB.query('SELECT id from notifications WHERE DOC_TYPE="view" AND objectType=$1 AND objectId=$2 AND userId=$3 LIMIT 1', [objectType, objectId, userId])
    if (!results || !results[0] || !results[0].id) throw new Error('notification not founded')
    var id = results[0].id
    debug('readedByObjectId id', id)
    var func = (data, currentState, userId, permissions) => {
      debug('readedByObjectId currentState', currentState)
      if (!currentState) throw new Error('problems during set readed')
      if (!permissions['notificationsWrite'] && currentState.userId !== userId) throw new Error('user cant write for other notifications')
    }
    await basicMutationRequest({id, data: reqData, mutation: 'readed', meta, func})
    return {success: `Notification readed`}
  },
  async  serviceInfo (reqData, meta = {directCall: true}, getStream = null) {
    var hash = (s) => { return s.split('').reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0) }
    var schema = require('./schema')
    var schemaOut = {}
    for (var i in schema.methods) if (schema.methods[i].public) schemaOut[i] = schema.methods[i].requestSchema
    var mutations = {}
    require('fs').readdirSync(path.join(__dirname, '/mutations')).forEach(function (file, index) { mutations[file] = require(path.join(__dirname, '/mutations/', file)).toString() })
    debug('serviceInfo', {schema, mutations})
    var mutationsHash = hash(JSON.stringify(mutations))
    var schemaHash = hash(JSON.stringify(schemaOut))
    var results = {schemaHash, mutationsHash}
    if (reqData.mutationsHash !== mutationsHash)results.mutations = mutations
    if (reqData.schemaHash !== schemaHash)results.schema = mutations
    return results
  }
  // async updatePassword (reqData, meta = {directCall: true}, getStream = null) {
  //   var id = reqData.id
  //   if (reqData.password !== reqData.confirmPassword) throw new Error('Confirm Password not equal')
  //   var func = (data, currentState, userId, permissions) => {
  //     if (currentState.password && !bcrypt.compareSync(reqData.oldPassword, currentState.password)) throw new Error('Old Password not valid')
  //     if (!currentState || currentState.deleted || !currentState.passwordAssigned || !currentState.emailConfirmed) throw new Error('problems during updatePassword')
  //     debug('updatePersonalInfo', {userId, currentState})
  //     if (!permissions['notificationsWrite'] && currentState.userId !== userId) throw new Error('user cant write for other notifications')
  //   }
  //   var bcrypt = require('bcrypt')
  //   var data = {password: bcrypt.hashSync(reqData.password, 10)}
  //   await basicMutationRequest({id, data, mutation: 'updatePassword', meta, func})
  //   return {success: `Password updated`}
  // },
  // async addPic (reqData, meta = {directCall: true}, getStream = null) {
  //   const picLib = require('sint-bit-utils/utils/pic')
  //   var id = reqData.id
  //   var picId = uuidv4()
  //   var func = async (data, currentState, userId, permissions) => {
  //     try {
  //       if (!currentState || currentState.deleted || !currentState.passwordAssigned || !currentState.emailConfirmed) throw new Error('problems during addPic')
  //       if (!permissions['notificationsWrite'] && currentState.userId !== userId) throw new Error('user cant write for other notifications')
  //     } catch (error) {
  //       await new Promise((resolve, reject) => fs.unlink(reqData.pic.path, (err, data) => err ? resolve(err) : resolve(data)))
  //       throw error
  //     }
  //   }
  //   var picBuffers = await picLib.resizeAndGetBuffers(reqData.pic.path, CONFIG.uploadPath, [['mini', 100, 100]])
  //   var picData = {picId, sizes: {}}
  //   for (var size in picBuffers) {
  //     var picSizeId = uuidv4()
  //     picData.sizes[size] = picSizeId
  //     await DB.put('notificationsPics', picBuffers[size], picSizeId)
  //   }
  //   await DB.put('notificationsPics', {id: picId, userId: id, sizes: picData.sizes}, picId + '_meta')
  //
  //   // debug('addPic picBuffers', picBuffers)
  //   await basicMutationRequest({id, data: {pic: picData}, mutation: 'addPic', meta, func})
  //   return {success: `Pic Added`, data: picData}
  //   // var id = reqData.id
  //   // return await pic.updatePic(aerospikeConfig, kvDbClient, id, reqData.pic.path, CONFIG.uploadPath, [['mini', 100, 100]])
  // },
  // async getPic (reqData, meta = {directCall: true}, getStream = null) {
  //   var picMeta = await DB.get('notificationsPics', reqData.id + '_meta')
  //   if (!picMeta || picMeta.deleted) throw new Error('problems with picMeta')
  //   var currentState = await getViews(picMeta.userId)
  //   if (!currentState || currentState.deleted || !currentState.passwordAssigned || !currentState.emailConfirmed) throw new Error('problems during getPic')
  //   if (!picMeta.sizes || !picMeta.sizes[reqData.size]) throw new Error('problems with picSizeId')
  //   var picSizeId = picMeta.sizes[reqData.size]
  //   return DB.get('notificationsPics', picSizeId)
  //   // return await pic.getPic(aerospikeConfig, kvDbClient, reqData.id, reqData.size || 'mini')
  // },
  // async deletePic (reqData, meta = {directCall: true}, getStream = null) {
  //   var picMeta = await DB.get('notificationsPics', reqData.id + '_meta')
  //   if (!picMeta || picMeta.deleted) throw new Error('problems with picMeta')
  //   // var currentState = await getViews(picMeta.userId)
  //   var func = async (data, currentState, userId, permissions) => {
  //     if (!currentState || currentState.deleted || !currentState.passwordAssigned || !currentState.emailConfirmed) throw new Error('problems during deletePic')
  //     if (!permissions['notificationsWrite'] && currentState.userId !== userId) throw new Error('user cant write for other notifications')
  //   }
  //   await basicMutationRequest({id: picMeta.userId, data: {picId: reqData.id}, mutation: 'deletePic', meta, func})
  //   picMeta.deleted = true
  //   await DB.put('notificationsPics', picMeta, reqData.id + '_meta')
  //   return {success: `Pic Deleted`, data: picMeta}
  // },
  // async confirmEmail (reqData, meta = {directCall: true}, getStream = null) {
  //   var currentState = await getNotificationByMail(reqData.email)
  //   if (!currentState) throw new Error('email is confirmed or notification is not registered')
  //   if (currentState.emailConfirmationCode !== reqData.emailConfirmationCode) throw new Error('email confirmation code not valid')
  //   var id = currentState.id
  //   await mutateAndUpdate('confirmEmail', [{id, data: {}}], meta, [currentState])
  //   // // var mutation = await mutate({ data: {}, objId: id, mutation: 'confirmEmail', meta })
  //   // // await updateView(id, [mutation])
  //   // await addTag(id, 'emailConfirmed', meta)
  //   return {success: `Email confirmed`, data: {email: reqData.email}}
  // }
}
