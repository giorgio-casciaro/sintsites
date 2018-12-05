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

const updateViews = async function (mutations, views) {
  try {
    if (!views) {
      var ids = mutations.map((mutation) => mutation.objId)
      views = await getViews(ids)
    }
    views = views.map((view) => view || {})
    var viewsById = arrayToObjBy(views, 'id')
    var viewsToUpdate = []
    mutations.forEach((mutation, index) => {
      var view = viewsById[mutation.objId] || {}
      view.VIEW_META = view.VIEW_META || {}
      view.VIEW_META.updated = Date.now()
      view.VIEW_META.created = view.VIEW_META.created || Date.now()
      viewsById[mutation.objId] = mutationsPack.applyMutations(view, [mutation])
      viewsToUpdate.push(viewsById[mutation.objId])
    })
    var results = await DB.upsertMulti('view', viewsToUpdate)
    if (!results) return null
    // MUTATION INFO
    results = results.map((result, index) => Object.assign(result, { mutation: mutations[index].name }))
    // EMIT MUTATION
    results.forEach((result, index) => {
      if (result.error) return null
      var mutation = mutations[index]
      var view = viewsById[mutation.objId]
      netClient.emit('POSTS_ENTITY_MUTATION', { id: result.id, mutation, dashId: view.dashId, toTags: view.toTags, toRoles: view.toRoles })
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

var linkedSubscriptions = async function (idsOrItems, meta, userId, permissionsToCheck) {
  if (!Array.isArray(idsOrItems)) { idsOrItems = [idsOrItems]; var single = true }
  var dashIds = idsOrItems.filter(value => value).map(item => typeof item === 'object' ? item.dashId : item).filter((v, i, a) => a.indexOf(v) === i)
  var items = dashIds.map((dashId) => ({dashId, userId}))
  var subscriptions = await subscriptionsReadMulti(items, meta)
  var byDashId = arrayToObjBy(subscriptions, 'dashId')
  var permissionsByDashId = {}
  subscriptions.forEach((subscription) => {
    // debug('linkedSubscriptions', subscription)
    permissionsByDashId[subscription.dashId] = {}
    subscription.permissions.forEach((item) => {
      permissionsByDashId[subscription.dashId][item] = true
    })
  })
  return single ? { dashId: dashIds[0], subscription: subscriptions[0], permissions: permissionsByDashId[dashIds[0]] } : { dashIds, byDashId, permissionsByDashId }
}
var subscriptionsReadMulti = async (items, meta) => {
  var response = await rpcSubscriptionsReadMulti(items, meta)
  if (response.errors) throw new Error('subscriptionsReadMulti => ' + response.errors)
  return response.results
}
var rpcSubscriptionsReadMulti = (items, meta) => netClient.rpcCall({to: 'subscriptions', method: 'readMulti', data: {items, linkedViews: ['permissions']}, meta})

var basicMutationRequest = async function ({ids, dataArray, mutation, extend, meta, func}) {
  debug('basicMutationRequest', {ids, dataArray, mutation, extend, meta})
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  if (extend)dataArray = dataArray.map(data => Object.assign(data, extend))
  var currentStates = await getViews(ids, '*', false)
  debug('basicMutationRequest currentStates', {currentStates, userId})
  var subscriptions = await linkedSubscriptions(currentStates, meta, userId)
  var resultsQueue = queueObj()
  ids.forEach((id, index) => {
    var data = dataArray[index] || {id}
    data.id = id
    var currentState = currentStates[index]
    var dashId
    if (data && data.dashId)dashId = data.dashId
    if (currentState && currentState.dashId)dashId = currentState.dashId
    if (!dashId || !subscriptions.permissionsByDashId[dashId])error('Dash Id not defined', {data, currentState})
    var permissions = subscriptions.permissionsByDashId[dashId]
    func(resultsQueue, data, currentState, userId, permissions)
  })
  await resultsQueue.resolve((dataToResolve) => mutateAndUpdate(mutation, dataToResolve, meta, currentStates))
  return resultsQueue.returnValue()
}

module.exports = {
  deleteMulti: async function (reqData, meta, getStream) {
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Posts not exists')
      if (currentState.userId !== userId && !permissions['postsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write subcriptions`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids: reqData.ids, extend: reqData.extend, dataArray: [], meta, mutation: 'delete', func})
  },
  confirmMulti: async function (reqData, meta, getStream) {
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Posts not exists')
      debug('confirmMulti userId, permissions', { userId, permissions })
      if (!permissions['postsConfirm'] && !permissions['postsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write subcriptions`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids: reqData.ids, extend: reqData.extend, dataArray: [], meta, mutation: 'confirm', func})
  },
  addTagsMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Posts not exists')
      if (currentState.userId !== userId && !permissions['postsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write subcriptions`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'addTags', func})
  },
  removeTagsMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Posts not exists')
      if (currentState.userId !== userId && !permissions['postsWrite']) {
        return resultsQueue.addError(data, `User ${userId} cant write subcriptions`)
      }
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'removeTags', func})
  },
  init: async function (setNetClient) {
    netClient = setNetClient
    await DB.init(CONFIG.couchbase.url, CONFIG.couchbase.username, CONFIG.couchbase.password, CONFIG.couchbase.bucket)
    await DB.createIndex(['dashId', 'userId'])
    await DB.createIndex(['userId'])
    await DB.createIndex(['public'])
    await DB.createIndex(['DOC_TYPE'])
  },
  rawMutateMulti: async function (reqData, meta, getStream) {
    if (reqData.extend)reqData.items.forEach(item => Object.assign(item.data, reqData.extend))
    reqData.items.forEach(item => { if (!item.id)item.id = item.data.id = itemId(item) })
    var results = await mutateAndUpdate(reqData.mutation, reqData.items, meta)
    debug('rawMutateMulti', results)
    return {results}
  },
  createMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => itemId(item))
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (currentState) return resultsQueue.addError(data, 'Posts exists')
      if (!permissions['postsWrite']) return resultsQueue.addError(data, userId + ' can\'t write posts')
      if (data.userId !== userId && !permissions['postsWriteOtherUsers']) return resultsQueue.addError(data, data.dashId + ' ' + userId + ' can\'t write posts for other users')
      if (!data.meta)data.meta = {}
      if (permissions['postsConfirm'])data.confirmed = 1
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'create', func})
  },
  readMulti: async function (reqData, meta, getStream) {
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var currentStates = await getViews(reqData.ids, reqData.select || '*', false)
    var subscriptions = await linkedSubscriptions(currentStates, meta, userId)
    // var dashboardsAndPermissions = await linkedDashboards(currentStates, meta, userId, ['postsRead', 'postsReadAll'])
    debug('readMulti', {subscriptions, currentStates})
    var results = currentStates.map((currentState, index) => {
      if (!currentState) return resultsError({id: reqData.ids[index]}, 'Post not exists')
      var subscription = subscriptions.byDashId[currentState.dashId]
      var permissions = subscriptions.permissionsByDashId[currentState.dashId]
      if (!permissions['postsRead']) return resultsError(currentState, 'User can\'t read posts')
      if (currentState.userId !== userId && !permissions['postsReadAll']) {
        if ((currentState.deleted || !currentState.confirmed)) return resultsError(currentState, 'User cant read hidden posts')
        if (!currentState.public) {
          if (!subscription || (!subscription.tags && !subscription.roleId)) return resultsError(currentState, 'User cant read, tags or roleId empty')
          var toTagsIntersection = subscription.tags.filter((n) => currentState.toTags.includes(n)).length > 0
          var toRolesIntersection = currentState.toRoles.includes(subscription.roleId)
          debug('readMulti tags', {tags: subscription.tags, toTags: currentState.toTags, roleId: subscription.roleId, toRoles: currentState.toRoles, toRolesIntersection, toTagsIntersection})
          if (!toTagsIntersection && !toRolesIntersection) return resultsError(currentState, 'User cant read, not have role or tag')
        }
      }
      return currentState
    })
    var errors = results.filter(value => value.__RESULT_TYPE__ === 'error').map((currentState, index) => index)
    return {results, errors: errors.length ? errors : undefined}
  },
  updateMulti: async function (reqData, meta, getStream) {
    var ids = reqData.items.map(item => item.id)
    var func = (resultsQueue, data, currentState, userId, permissions) => {
      if (!currentState) return resultsQueue.addError(data, 'Posts not exists')
      if (!permissions['postsWrite']) return resultsQueue.addError(currentState, userId + ' can\'t write posts')
      if (currentState.userId !== userId && !permissions['postsWriteOtherUsers']) return resultsQueue.addError(currentState, currentState.dashId + ' ' + userId + ' can\'t write posts for other users')
      resultsQueue.add(data.id, data)
    }
    return basicMutationRequest({ids, extend: reqData.extend, dataArray: reqData.items, meta, mutation: 'update', func})
  },
  list: async function (reqData, meta, getStream) {
    var dashId = reqData.dashId
    var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
    var subscription = await linkedSubscriptions(dashId, meta, userId)
    if (!subscription.permissions['postsRead']) { throw new Error('Cant read posts from dashboard ' + dashId) }
    var select = reqData.select || false
    var offset = reqData.from || 0
    var limit = reqData.to || 20 - offset
    var querySelect = select ? ' SELECT ' + select.join(',') + ' FROM `posts` ' : ' SELECT item.* FROM `posts` item ' // OR ARRAY_LENGTH(ARRAY_INTERSECT(item.toTags,$4)) > 0 OR ARRAY_CONTAINS(item.toRoles,$5)
    var queryWhere = ' WHERE  DOC_TYPE="view" AND dashId=$3 '
    if (!subscription.permissions['postsReadAll'])queryWhere += ' AND (item[\'public\']=true OR ARRAY_LENGTH(ARRAY_INTERSECT(item.toTags,$5)) > 0 OR ARRAY_CONTAINS(item.toRoles,$6)) AND (item.userId=$4 OR ((item.deleted IS MISSING OR item.deleted=false) AND item.confirmed=true)) '
    var queryOrderAndLimit = ' ORDER BY item.VIEW_META.updated DESC LIMIT $1 OFFSET $2 '
    debug('list subscription', subscription.subscription)
    var results = await DB.query(querySelect + queryWhere + queryOrderAndLimit, [limit, offset, dashId, userId, subscription.subscription.tags, subscription.subscription.roleId])
    debug('list results', results)
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
