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

var rpcSubscriptionsListByUserId = (userId, meta) => netClient.rpcCall({to: 'subscriptions', method: 'listByUserId', data: {userId}, meta})
var subscriptionsListByUserId = async(userId, meta) => {
  var response = await rpcSubscriptionsListByUserId(userId, meta)
  log('subscriptionsListByUserId', response)
  if (response.errors) throw new Error('subscriptionsListByUserId => ' + response.errors)
  return response.results
}

var rpcSubscriptionsCreateMulti = (items, meta) => netClient.rpcCall({to: 'subscriptions', method: 'createMulti', data: {items}, meta})
var subscriptionsCreate = async(item, meta) => {
  var response = await rpcSubscriptionsCreateMulti([item], meta)
  log('subscriptionsCreateMulti', response)
  if (!response.results || !response.results[0] || !response.results[0].success || response.results[0].error) throw new Error('subscriptionsCreateMulti => ' + JSON.stringify(response))
  return response.results[0]
}

const extendDashRoles = function (currentState) {
  if (!currentState) return null
  debug('extendDashRoles', currentState)
  for (var roleId in currentState.roles || []) {
    var role = currentState.roles[roleId]
    var rolePermissions = role.permissions
    if (role.id === 'guest' && currentState.options.guestRead === 'allow') {
      rolePermissions.push('postsRead')
      rolePermissions.push('subscriptionsRead')
      // rolePermissions.push('dashboardsRead')
    }
    if (role.id === 'guest' && currentState.options.guestSubscribe === 'allow') {
      rolePermissions.push('subscriptionsWrite')
      rolePermissions.push('subscriptionsConfirm')
    }
    if (role.id === 'guest' && currentState.options.guestSubscribe === 'confirm') {
      rolePermissions.push('subscriptionsWrite')
    }
    if (role.id === 'guest' && currentState.options.guestWrite === 'allow') {
      rolePermissions.push('postsWrite')
      rolePermissions.push('postsConfirm')
    }
    if (role.id === 'guest' && currentState.options.guestWrite === 'confirm') {
      rolePermissions.push('postsWrite')
    }
    if (role.id === 'subscriber' && currentState.options.subscriberWrite === 'allow') {
      rolePermissions.push('postsWrite')
      rolePermissions.push('postsConfirm')
    }
    if (role.id === 'subscriber' && currentState.options.subscriberWrite === 'confirm') {
      rolePermissions.push('postsWrite')
    }
  }
  return currentState
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
      netClient.emit('DASHBOARDS_ENTITY_MUTATION', { id: result.id, mutation })//, dashId: view.dashId, toTags: view.toTags, toRoles: view.toRoles
    })
    return results
  } catch (error) { throw new Error('problems during updateViews ' + error) }
}
const mutateAndUpdate = async function (mutation, dataToResolve, meta, views) {
  try {
    debug('mutateAndUpdate', {mutation, dataToResolve, views})
    var mutations = dataToResolve.map((mutationAndData) => mutationsPack.mutate({data: mutationAndData.data, objId: mutationAndData.id, mutation, meta}))
    DB.upsertMulti('mutation', mutations)
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
  var func = async (resultsQueue, data, currentState, userId, permissions, dashboardPermissions) => {
    // if (currentState) return resultsQueue.addError(data, 'Subscriptions exists')
    if (!permissions['dashboardsCreate']) return resultsQueue.addError(data, 'User cant createdashboards')
    var createAdminSubscription = await subscriptionsCreate({dashId: data.id, roleId: 'admin', userId}, meta)
    debug('createAdminSubscription', createAdminSubscription)
    if (!createAdminSubscription) return resultsQueue.addError(data, 'problems with subscriptionsCreate')
    resultsQueue.add(data.id, data)
  }

  var response = await basicMutationRequestMulti({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'create', func, loadViews: false})
  // await sendMail('dashboardCreated', {to: reqData.email, from: CONFIG.mailFrom, subject: 'Benvenuto in CivilConnect - conferma la mail'}, Object.assign({CONFIG}, reqData))
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
  var userSubscriptions = await subscriptionsListByUserId(userId, meta) || []
  var userSubscriptionsByDashId = arrayToObjBy(userSubscriptions, 'dashId')
  debug('userSubscriptionsByDashId', {userSubscriptionsByDashId})
  var resultsQueue = queueObj()
  for (var index in ids) {
    var data = dataArray[index] || {id: ids[index]}
    data.id = ids[index]
    var currentState = extendDashRoles(currentStates[index])
    var userDashboardRole = (userSubscriptionsByDashId[data.id] && userSubscriptionsByDashId[data.id].roleId) ? userSubscriptionsByDashId[data.id].roleId : 'guest'
    var dashboardPermissionsArray = (currentState && currentState.roles && currentState.roles[userDashboardRole] && currentState.roles[userDashboardRole].permissions) ? currentState.roles[userDashboardRole].permissions : []
    var dashboardPermissions = dashboardPermissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
    debug('basicMutationRequestMulti', {userDashboardRole, dashboardPermissions})
    await func(resultsQueue, data, currentState, userId, permissions, dashboardPermissions, dashboardPermissions)
  }
  await resultsQueue.resolve((dataToResolve) => mutateAndUpdate(mutation, dataToResolve, meta, currentStates))
  return resultsQueue.returnValue()
}
var basicMutationRequest = async function ({id, data, mutation, meta, func}) {
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
  var permissionsArray = tokenData.permissions || []
  var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
  var userSubscriptions = await subscriptionsListByUserId(userId, meta) || []
  var userSubscriptionsByDashId = arrayToObjBy(userSubscriptions, 'dashId')
  var userDashboardRole = (userSubscriptionsByDashId[id] && userSubscriptionsByDashId[id].roleId) ? userSubscriptionsByDashId[id].roleId : 'guest'
  var currentState = extendDashRoles(await getViews(id, '*', false))
  var dashboardPermissionsArray = (currentState && currentState.roles && currentState.roles[userDashboardRole] && currentState.roles[userDashboardRole].permissions) ? currentState.roles[userDashboardRole].permissions : []
  var dashboardPermissions = dashboardPermissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
  debug('basicMutationRequest', {tokenData, permissions, userId, userDashboardRole, currentState, dashboardPermissions})
  await func(data, currentState, userId, permissions, dashboardPermissions)
  await mutateAndUpdate(mutation, [{id, data}], meta, [ currentState ])
}

module.exports = {
  deleteMulti: async function (reqData, meta, getStream) {
    var func = (resultsQueue, data, currentState, userId, permissions, dashboardPermissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Dashboard not exists')
      debug('deleteMulti permissions', {id: currentState.id, userId, permissions})
      if (!dashboardPermissions['dashboardsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write dashboards`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids: reqData.ids, extend: reqData.extend, dataArray: [], meta, mutation: 'delete', func})
  },
  confirmMulti: async function (reqData, meta, getStream) {
    var func = (resultsQueue, data, currentState, userId, permissions, dashboardPermissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Dashboard not exists')
      debug('confirmMulti userId, permissions', { userId, permissions })
      if (!dashboardPermissions['dashboardsConfirm'] && !dashboardPermissions['dashboardsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write dashboards`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids: reqData.ids, extend: reqData.extend, dataArray: [], meta, mutation: 'confirm', func})
  },
  addTagsMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, permissions, dashboardPermissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Dashboard not exists')
      if (!dashboardPermissions['dashboardsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write dashboards`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'addTags', func})
  },
  removeTagsMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, permissions, dashboardPermissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Dashboard not exists')
      if (!dashboardPermissions['dashboardsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write dashboards`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'removeTags', func})
  },
  init: async function (setNetClient) {
    netClient = setNetClient
    await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.dashboardname, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
    await DB.createIndex(['id'])
    await DB.createIndex(['meta'])
    await DB.createIndex(['DOC_TYPE'])
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
    var userSubscriptions = await subscriptionsListByUserId(userId, meta) || []
    var userSubscriptionsByDashId = arrayToObjBy(userSubscriptions, 'dashId')

    var results = currentStates.map((currentState, index) => {
      if (!currentState) return resultsError({id: reqData.ids[index]}, 'Dashboard not exists')
      var userDashboardRole = (userSubscriptionsByDashId[currentState.id] && userSubscriptionsByDashId[currentState.id].roleId) ? userSubscriptionsByDashId[currentState.id].roleId : 'guest'
      var dashboardPermissionsArray = (currentState && currentState.roles && currentState.roles[userDashboardRole] && currentState.roles[userDashboardRole].permissions) ? currentState.roles[userDashboardRole].permissions : []
      var dashboardPermissions = dashboardPermissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
      if ((currentState.deleted) && (!permissions['dashboardsReadAll'] || !dashboardPermissions['dashboardsWrite'])) return resultsError(currentState, 'User cant read hidden dashboards')
      return extendDashRoles(currentState)
    })
    var errors = results.filter(value => value.__RESULT_TYPE__ === 'error').map((currentState, index) => index)
    debug('readMultireadMulti', {results, errors: errors.length ? errors : undefined})
    return {results, errors: errors.length ? errors : undefined}
  },
  updateMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, permissions, dashboardPermissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Dashboard not exists')
      // if (!dashboardPermissions['dashboardsWrite']) return resultsQueue.addError(currentState, userId + ' can\'t write dashboards')
      debug('updateMulti permissions', permissions)
      if (!dashboardPermissions['dashboardsWrite']) return resultsQueue.addError(currentState, userId + ' can\'t write dashboards ')
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequestMulti({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'update', func})
  },
  list: async function (reqData, meta, getStream) {
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var tokenData = await auth.getTokenDataFromToken(meta, CONFIG.jwt)
    var permissionsArray = tokenData.permissions || []
    var permissions = permissionsArray.reduce((accumulator, currentValue, currentIndex, array) => Object.assign(accumulator, {[currentValue]: true}), {})
    if (!permissions['dashboardsList']) throw new Error('user cant list dashboards')
    // var subscription = await linkedSubscriptions(dashId, meta, userId)
    // if (!subscription.dashboardPermissions['dashboardsRead']) { throw new Error('Cant read dashboards from dashboard ' + dashId) }
    var select = reqData.select || false
    var offset = reqData.from || 0
    var limit = reqData.to || 20 - offset
    var querySelect = select ? ' SELECT ' + select.join(',') + ' FROM dashboards ' : ' SELECT item.* FROM dashboards item '
    var queryWhere = ' where  DOC_TYPE="view"'
    if (!permissions['dashboardsReadAll'])queryWhere += ' AND (item.id=$1 OR ((item.deleted IS MISSING OR item.deleted=false) )) '
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
    if (userId !== reqData.userId && !permissions['dashboardsList']) throw new Error('user cant list dashboards')
    // var subscription = await linkedSubscriptions(dashId, meta, userId)
    // if (!subscription.dashboardPermissions['dashboardsRead']) { throw new Error('Cant read dashboards from dashboard ' + dashId) }
    var select = reqData.select || false
    var offset = reqData.from || 0
    var limit = reqData.to || 20 - offset
    var querySelect = select ? ' SELECT ' + select.join(',') + ' FROM dashboards  ' : ' SELECT item.* FROM dashboards item '
    var queryWhere = ' where DOC_TYPE="view" AND userId=$1 '
    if (!permissions['dashboardsReadAll'])queryWhere += ' AND (item.deleted IS MISSING OR item.deleted=false) '
    var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $2 OFFSET $3 '
    var results = await DB.query(querySelect + queryWhere + queryOrderAndLimit, [reqData.userId, limit, offset])
    debug('listByUserId results', results)
    return {results}
  },
  async addPic (reqData, meta = {directCall: true}, getStream = null) {
    const picLib = require('sint-bit-utils/utils/pic')
    var id = reqData.id
    var picId = uuidv4()
    var func = async (data, currentState, userId, permissions, dashboardPermissions) => {
      try {
        if (!currentState || currentState.deleted) throw new Error('problems during addPic')
        if (!dashboardPermissions['dashboardsWrite']) throw new Error('user cant write for other dashboards')
      } catch (error) {
        await new Promise((resolve, reject) => require('fs').unlink(reqData.pic.path, (err, data) => err ? resolve(err) : resolve(data)))
        throw error
      }
    }
    var picBuffers = await picLib.resizeAndGetBuffers(reqData.pic.path, CONFIG.uploadPath, [['mini', 100, 100]])
    var picData = {picId, sizes: {}}
    for (var size in picBuffers) {
      var picSizeId = uuidv4()
      picData.sizes[size] = picSizeId
      await DB.put('pic', picBuffers[size], picSizeId)
    }
    await DB.put('pic', {id: picId, userId: id, sizes: picData.sizes}, picId + '_meta')

    debug('addPic picBuffers', {pic: picData})
    await basicMutationRequest({id, data: {pic: picData}, mutation: 'addPic', meta, func})
    return {success: `Pic Added`, data: picData}
    // var id = reqData.id
    // return await pic.updatePic(aerospikeConfig, kvDbClient, id, reqData.pic.path, CONFIG.uploadPath, [['mini', 100, 100]])
  },
  async getPic (reqData, meta = {directCall: true}, getStream = null) {
    var picMeta = await DB.get(reqData.id + '_meta')
    if (!picMeta || picMeta.deleted) throw new Error('problems with picMeta')
    var currentState = await getViews(picMeta.userId)
    if (!currentState || currentState.deleted) throw new Error('problems during getPic')
    if (!picMeta.sizes || !picMeta.sizes[reqData.size]) throw new Error('problems with picSizeId')
    var picSizeId = picMeta.sizes[reqData.size]
    return DB.get(picSizeId)
    // return await pic.getPic(aerospikeConfig, kvDbClient, reqData.id, reqData.size || 'mini')
  },
  async deletePic (reqData, meta = {directCall: true}, getStream = null) {
    var picMeta = await DB.get(reqData.id + '_meta')
    if (!picMeta || picMeta.deleted) throw new Error('problems with picMeta')
    // var currentState = await getViews(picMeta.userId)
    var func = async (data, currentState, userId, permissions, dashboardPermissions) => {
      if (!currentState || currentState.deleted) throw new Error('problems during deletePic')
      if (!dashboardPermissions['dashboardsWrite']) throw new Error('user cant write for other dashboards')
    }
    await basicMutationRequest({id: picMeta.userId, data: {picId: reqData.id}, mutation: 'deletePic', meta, func})
    picMeta.deleted = true
    await DB.put('pic', picMeta, reqData.id + '_meta')
    return {success: `Pic Deleted`, data: picMeta}
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
