const path = require('path')
const DB = require('sint-bit-utils/utils/dbCouchbaseV3')
var CONFIG = require('./config')
var mutationsPack = require('sint-bit-cqrs/mutations')({ mutationsPath: path.join(__dirname, '/mutations') })
const auth = require('sint-bit-utils/utils/auth')
var netClient

const log = (msg, data) => { console.log('\n' + JSON.stringify(['LOG', 'MAIN', msg, data])) }
const debug = (msg, data) => { if (process.env.debugMain)console.log('\n' + JSON.stringify(['DEBUG', 'MAIN', msg, data])) }
const error = (msg, data) => { console.log('\n' + JSON.stringify(['ERROR', 'MAIN', msg, data])); console.error(data) }

const arrayToObjBy = (array, prop) => array.reduce((newObj, item) => { newObj[item[prop]] = item; return newObj }, {})

// var resultsError = (id, msg) => { return {id: id, __RESULT_TYPE__: 'error', error: msg} }
var resultsError = (item, msg) => { return {id: item.id || 'unknow', __RESULT_TYPE__: 'error', error: msg} }
var queueObj = require('sint-bit-utils/utils/queueObj')(resultsError)

var itemId = (dashId, userId) => dashId + '_' + userId
var dashIdUserIdFromItemId = (itemId) => itemId.split('_')
var guestSubscription = (subscriptionId) => {
  var dashIdUserId = dashIdUserIdFromItemId(subscriptionId)
  debug('guestSubscription', {subscriptionId, dashId: dashIdUserId[0], userId: dashIdUserId[1]})
  return {id: subscriptionId, roleId: 'guest', dashId: dashIdUserId[0], userId: dashIdUserId[1], meta: {confirmed: true}, permissions: []}
}

// const updateViews = async function (mutations, views) {
//   try {
//     if (!views) {
//       var ids = mutations.map((mutation) => mutation.objId)
//       views = await getViews(ids)
//     }
//     views = views.map((view) => view || {})
//     var viewsById = arrayToObjBy(views, 'id')
//     var viewsToUpdate = []
//     debug('updateViews', { views, mutations })
//     mutations.forEach((mutation, index) => {
//       var view = viewsById[mutation.objId] || {}
//       view.meta = view.meta || {}
//       view.VIEW_META.updated = Date.now()
//       view.meta.created = view.meta.created || Date.now()
//       viewsById[mutation.objId] = mutationsPack.applyMutations(view, [mutation])
//       viewsToUpdate.push(viewsById[mutation.objId])
//     })
//     return await DB.upsertMulti('view', viewsToUpdate)
//   } catch (error) { throw new Error('problems during updateViews ' + error) }
// }
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
      netClient.emit('SUBSCRIPTIONS_ENTITY_MUTATION', { id: result.id, mutation })//, dashId: view.dashId, toTags: view.toTags, toRoles: view.toRoles
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
  if (guest)views = views.map((view, index) => view || guestSubscription(ids[index]))
  if (single) return views[0]
  else return views
}

var rpcDashboardsReadMulti = (ids, meta) => netClient.rpcCall({to: 'dashboards', method: 'readMulti', data: {ids}, meta})
var dashboardsReadMulti = async(ids, meta) => {
  var response = await rpcDashboardsReadMulti(ids, meta)
  if (response.error) throw new Error('dashboardsReadMulti => ' + response.error)
  log('dashboardsReadMulti', response)
  return response.results
}
var linkedDashboards = async function (idsOrItems, meta, userId, permissionsToCheck) {
  if (!Array.isArray(idsOrItems)) { idsOrItems = [idsOrItems]; var single = true }
  var ids = idsOrItems.filter(value => value).map(item => typeof item === 'object' ? item.dashId : item).filter((v, i, a) => a.indexOf(v) === i)
  var dashboards = await dashboardsReadMulti(ids, meta)
  var byId = arrayToObjBy(dashboards, 'id')
  var userSubscriptionsIds = dashboards.map(dashboard => itemId(dashboard.id, userId))
  var userSubscriptions = await getViews(userSubscriptionsIds, '*', true)
  var userSubscriptionsByDashId = arrayToObjBy(userSubscriptions, 'dashId')
  var permissions = {}
  dashboards.forEach(dashboard => {
    permissions[dashboard.id] = dashboard.roles[userSubscriptionsByDashId[dashboard.id].roleId].permissions.reduce((acc, value) => Object.assign(acc, {[value]: true}), {})
  })
  return single ? { id: ids[0], dashboard: dashboards[0], permissions: permissions[dashboards[0].id] } : { ids, dashboards, permissions, byId }
}
var rpcUsersReadMulti = (ids, meta) => netClient.rpcCall({to: 'users', method: 'readMulti', data: {ids}, meta})
var usersReadMulti = async(ids, meta) => {
  var response = await rpcUsersReadMulti(ids, meta)
  return response.results
}
var linkedUsers = async function (idsOrItems, meta) {
  var ids = idsOrItems.filter(value => value).map(item => typeof item === 'object' ? item.dashId : item).filter((v, i, a) => a.indexOf(v) === i)
  var users = await usersReadMulti(ids, meta)
  var byId = arrayToObjBy(users, 'id')
  return { ids, users, byId }
}
var basicMutationRequest = async function ({ids, dataArray, mutation, extend, meta, permissions, func}) {
  debug('basicMutationRequest', {ids, dataArray, mutation, extend, meta})
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  if (extend)dataArray = dataArray.map(data => Object.assign(data, extend))
  var currentStates = await getViews(ids, '*', false)
  debug('basicMutationRequest currentStates', {currentStates, userId})
  var dashboardsAndPermissions = await linkedDashboards(currentStates, meta, userId, permissions)
  var resultsQueue = queueObj()
  ids.forEach((id, index) => {
    var data = dataArray[index] || {id}
    var currentState = currentStates[index]
    var permissions = dashboardsAndPermissions.permissions[currentState.dashId || data.dashId]
    func(resultsQueue, data, currentState, userId, dashboardsAndPermissions[currentState.dashId || data.dashId], permissions)
  })
  await resultsQueue.resolve((dataToResolve) => mutateAndUpdate(mutation, dataToResolve, meta, currentStates))
  return resultsQueue.returnValue()
}

module.exports = {
  deleteMulti: async function (reqData, meta, getStream) {
    var func = (resultsQueue, data, currentState, userId, dashboard, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Subscriptions not exists')
      if (currentState.userId !== userId && !permissions['subscriptionsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write subcriptions`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids: reqData.ids, extend: reqData.extend, dataArray: [], meta, mutation: 'delete', permissions: ['subscriptionsWrite'], func})
  },
  confirmMulti: async function (reqData, meta, getStream) {
    var func = (resultsQueue, data, currentState, userId, dashboard, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Subscriptions not exists')
      debug('confirmMulti userId, permissions', { userId, permissions })
      if (!permissions['subscriptionsConfirm'] && !permissions['subscriptionsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write subcriptions`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids: reqData.ids, extend: reqData.extend, dataArray: [], meta, mutation: 'confirm', permissions: ['subscriptionsWrite', 'subscriptionsConfirm'], func})
  },
  addTagsMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, dashboard, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Subscriptions not exists')
      if (currentState.userId !== userId && !permissions['subscriptionsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write subcriptions`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'addTags', permissions: ['subscriptionsWrite'], func})
  },
  removeTagsMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, dashboard, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Subscriptions not exists')
      if (currentState.userId !== userId && !permissions['subscriptionsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write subcriptions`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'removeTags', permissions: ['subscriptionsWrite'], func})
  },
  init: async function (setNetClient) {
    netClient = setNetClient
    await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
    await DB.createIndex(['DOC_TYPE'])
    await DB.createIndex(['dashId', 'userId'])
    await DB.createIndex(['userId'])
  },
  rawMutateMulti: async function (reqData, meta, getStream) {
    if (reqData.extend)reqData.items.forEach(item => Object.assign(item.data, reqData.extend))
    reqData.items.forEach(item => { if (!item.id && item.data.dashId && item.data.userId)item.id = item.data.id = itemId(item.data.dashId, item.data.userId) })
    var results = await mutateAndUpdate(reqData.mutation, reqData.items, meta)
    debug('rawMutateMulti', results)
    return {results}
  },
  createMulti: async function (reqData, meta, getStream) {
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    if (reqData.extend)reqData.items = reqData.items.map(item => Object.assign(item, reqData.extend))

    var ids = reqData.items.map(item => itemId(item.dashId, item.userId))
    var currentStates = await getViews(ids, '*', false)
    var dashboardsAndPermissions = await linkedDashboards(reqData.items, meta, userId, ['subscriptionsSubscribe', 'subscriptionsWrite', 'subscriptionsSubscribeWithConfimation'])
    var resultsQueue = queueObj()

    reqData.items.forEach((item, index) => {
      if (currentStates[index]) return resultsQueue.addError(currentStates[index], 'Subscription exists')
      item = Object.assign({id: itemId(item.dashId, item.userId), roleId: 'subscriber'}, item)
      var permissions = dashboardsAndPermissions.permissions[item.dashId]
      var role = dashboardsAndPermissions.byId[item.dashId].roles[item.roleId]
      if (!role) return resultsQueue.addError(item, 'Role not exists or is not active')
      if (!permissions['subscriptionsWrite']) {
        if (!role.public) return resultsQueue.addError(item, item.dashId + ' ' + userId + ' can\'t write role ' + item.roleId + '  subscriptions')
        if (item.userId === userId) {
          if (permissions['subscriptionsSubscribe'])item.confirmed = 1
          else if (!permissions['subscriptionsSubscribeWithConfimation']) return resultsQueue.addError(item, item.dashId + ' ' + userId + ' can\'t subscribe')
        } else return resultsQueue.addError(item, item.dashId + ' ' + userId + ' can\'t create other users subscriptions')
      }
      resultsQueue.add(item.id, item)
    })

    await resultsQueue.resolve((dataToResolve) => mutateAndUpdate('create', dataToResolve, meta, currentStates))
    return resultsQueue.returnValue()
  },
  readMulti: async function (reqData, meta, getStream) {
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var currentStates = await getViews(reqData.ids, reqData.select || '*', false)
    var dashboardsAndPermissions = await linkedDashboards(currentStates, meta, userId, ['subscriptionsRead', 'subscriptionsReadAll'])
    if (reqData.linkedViews && reqData.linkedViews.includes('user')) {
      var users = await linkedUsers(currentStates, meta)
    }
    debug('readMulti', {dashboardsAndPermissions, currentStates, users})
    var results = currentStates.map((currentState, index) => {
      if (!currentState) return resultsError(reqData.ids[index], 'Subscription not exists')
      if (!dashboardsAndPermissions.permissions[currentState.dashId]['subscriptionsReadAll'] && currentState.userId !== userId && (currentState.deleted || !currentState.confirmed)) return resultsError(currentState.id, 'User cant read hidden subscriptions')
      if (reqData.linkedViews && reqData.linkedViews.includes('role')) currentState.role = dashboardsAndPermissions.byId[currentState.dashId].roles[currentState.roleId]
      if (reqData.linkedViews && reqData.linkedViews.includes('permissions')) currentState.permissions = dashboardsAndPermissions.byId[currentState.dashId].roles[currentState.roleId].permissions
      if (reqData.linkedViews && reqData.linkedViews.includes('dashboard')) currentState.role = dashboardsAndPermissions.byId[currentState.dashId]
      if (reqData.linkedViews && reqData.linkedViews.includes('user')) currentState.user = users.byId[currentState.userId]
      return currentState
    })
    var errors = results.filter(value => value.__RESULT_TYPE__ === 'error').map((currentState, index) => index)
    return {results, errors: errors.length ? errors : undefined}
  },
  updateMulti: async function (reqData, meta, getStream) {
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    if (reqData.extend)reqData.items = reqData.items.map(item => Object.assign(item, reqData.extend))
    var ids = reqData.items.map(item => item.id)
    var currentStates = await getViews(ids, '*', false)
    var dashboardsAndPermissions = await linkedDashboards(currentStates, meta, userId, ['subscriptionsWrite'])
    var resultsQueue = queueObj()
    debug('updateMulti', {dashboardsAndPermissions, currentStates})
    reqData.items.forEach((item, index) => {
      var currentState = currentStates[index]
      if (!currentState) return resultsQueue.addError(item, 'Subscriptions not exists')
      var permissions = dashboardsAndPermissions.permissions[currentState.dashId]
      debug('updateMulti items.forEach', {userId, permissions, currentState})
      if (currentState.userId !== userId && !permissions['subscriptionsWrite']) return resultsQueue.addError(item, `User ${userId} cant write subcriptions for ${currentState.userId}`)
      resultsQueue.add(item.id, item)
    })
    await resultsQueue.resolve((dataToResolve) => mutateAndUpdate('update', dataToResolve, meta, currentStates))
    return resultsQueue.returnValue()
  },
  list: async function (reqData, meta, getStream) {
    var dashId = reqData.dashId
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var dashboard = await linkedDashboards(dashId, meta, userId, ['subscriptionsRead', 'subscriptionsReadAll'])
    if (!dashboard.permissions['subscriptionsRead']) { throw new Error('Cant read subscriptions from dashboard ' + dashId) }
    var select = reqData.select || false
    var offset = reqData.from || 0
    var limit = reqData.to || 20 - offset
    var querySelect = select ? ' SELECT ' + select.join(',') + ' FROM subscriptions ' : ' SELECT item.* FROM subscriptions item '
    var queryWhere = ' WHERE DOC_TYPE="view" AND dashId=$1 '
    if (!dashboard.permissions['subscriptionsReadAll'])queryWhere += ' AND (item.userId=$2 OR ((item.deleted IS MISSING OR item.deleted=false) AND item.confirmed=true)) '
    var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $3  OFFSET $4 '
    var results = await DB.query(querySelect + queryWhere + queryOrderAndLimit, [dashId, userId, limit, offset])
    debug('list results', results)
    return {results}
  },
  listByDashIdTagsRoles: async function (reqData, meta, getStream) {
    var dashId = reqData.dashId
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var dashboard = await linkedDashboards(dashId, meta, userId, ['subscriptionsRead', 'subscriptionsReadAll'])
    if (!dashboard.permissions['subscriptionsRead']) { throw new Error('Cant read subscriptions from dashboard ' + dashId) }
    var select = reqData.select || false
    var offset = reqData.from || 0
    var limit = reqData.to || 20 - offset
    var tags = reqData.tags || []
    var roles = reqData.roles || []
    var querySelect = select ? ' SELECT ' + select.join(',') + ' FROM subscriptions ' : ' SELECT item.* FROM subscriptions item '
    var queryWhere = ' WHERE  DOC_TYPE="view" AND (dashId=$1 AND (ARRAY_LENGTH(ARRAY_INTERSECT(tags,$2)) > 0 OR roleId IN $3 )) '
    if (!dashboard.permissions['subscriptionsReadAll'])queryWhere += ' AND (item.userId=$4 OR ((item.deleted IS MISSING OR item.deleted=false) AND item.confirmed=true)) '
    var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $5  OFFSET $6 '
    var results = await DB.query(querySelect + queryWhere + queryOrderAndLimit, [dashId, tags, roles, userId, limit, offset])
    debug('listByDashIdTagsRoles results', results)
    return {results}
  },
  listByUserId: async function (reqData, meta, getStream) {
    var dashId = reqData.dashId
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    // var dashboard = await linkedDashboards(dashId, meta, userId, ['subscriptionsRead', 'subscriptionsReadAll'])
    if (userId !== reqData.userId) throw new Error('Cant read subscriptions from for other users ')
    var select = reqData.select || false
    var offset = reqData.from || 0
    var limit = reqData.to || 20 - offset
    var querySelect = select ? ' SELECT ' + select.join(',') + ' FROM subscriptions ' : ' SELECT item.* FROM subscriptions item '
    var queryWhere = ' WHERE  DOC_TYPE="view" AND userId=$1  '
    var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $2  OFFSET $3'
    var results = await DB.query(querySelect + queryWhere + queryOrderAndLimit, [userId, limit, offset])
    var dashboardsAndPermissions = await linkedDashboards(dashId, meta, userId, ['subscriptionsRead', 'subscriptionsReadAll'])
    results = results.map((currentState, index) => {
      if (reqData.linkedViews && reqData.linkedViews.includes('role')) currentState.role = dashboardsAndPermissions.byId[currentState.dashId].roles[currentState.roleId]
      if (reqData.linkedViews && reqData.linkedViews.includes('permissions')) currentState.permissions = dashboardsAndPermissions.byId[currentState.dashId].roles[currentState.roleId].permissions
      if (reqData.linkedViews && reqData.linkedViews.includes('dashboard')) currentState.role = dashboardsAndPermissions.byId[currentState.dashId]
      return currentState
    })
    debug('listByUserId results', results)
    return {results}
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
