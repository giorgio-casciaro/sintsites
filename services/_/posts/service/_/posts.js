var MODULE_NAME = 'Dashboard Posts - '

const path = require('path')
const uuid = require('uuid/v4')
const fs = require('fs')

const Aerospike = require('aerospike')
const Key = Aerospike.Key
const GeoJSON = Aerospike.GeoJSON
const kvDb = require('sint-bit-utils/utils/kvDb')
const pic = require('sint-bit-utils/utils/pic')

var CONFIG = require('./config')
var aerospikeConfig = CONFIG.aerospike.posts
var mutationsPack = require('sint-bit-cqrs/mutations')({ mutationsPath: path.join(__dirname, '/mutations') })

const auth = require('sint-bit-utils/utils/auth')

var kvDbClient
var CONSOLE
var dashboards
var netClient
const subscriptions = require('./subscriptions')

async function mutate (args) {
  try {
    var mutation = mutationsPack.mutate(args)
    var key = new Key(aerospikeConfig.namespace, aerospikeConfig.mutationsSet, mutation.id)
    await kvDb.put(kvDbClient, key, mutation)
    delete mutation.meta
    return mutation
  } catch (error) {
    throw new Error(MODULE_NAME + 'problems during mutate a ' + error)
  }
}

async function diffUpdatedView (oldState, newState) {
  var oldTags = oldState.tags ? oldState.tags : []
  var newTags = newState.tags ? newState.tags : []
  var dashId = newState.dashId
  var op = Aerospike.operator
  var ops = []

  // REMOVED TAGS
  var removedTags = oldTags.filter(x => newTags.indexOf(x) < 0)
  ops = ops.concat(removedTags.map((tag) => op.decr('#' + tag, 1)))
  // ADDED TAGS
  var addedTags = newTags.filter(x => oldTags.indexOf(x) < 0)
  ops = ops.concat(addedTags.map((tag) => op.incr('#' + tag, 1)))
  CONSOLE.hl('Posts diffUpdatedView', oldTags, newTags, removedTags, addedTags)
  CONSOLE.hl('Posts diffUpdatedView ops', ops)

  await kvDb.operate(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, dashId + '_meta'), ops)
  // var dashMeta = await getDashPostsMeta(dashId)
  // CONSOLE.hl('Posts diffUpdatedView dashMeta', dashMeta)
}
async function getDashPostsMeta (dashId) {
  var dashPostMeta = await kvDb.get(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, dashId + '_meta'))
  return dashPostMeta
}
async function updateView (id, mutations, isNew) {
  try {
    var key = new Key(aerospikeConfig.namespace, aerospikeConfig.set, id)
    var rawView = await getView(id, null, false) || {}
    var state = mutationsPack.applyMutations(rawView, mutations)
    var view = {
      updated: Date.now(),
      created: rawView.created || Date.now(),
      id: '' + state.id,
      dashId: '' + state.dashId,
      state: JSON.stringify(state),
      public: state.public || 0,
      tags: state.tags || [],
      toTags: state.toTags || [],
      toRoles: state.toRoles || []
    }
    if (state.location)view.location = state.location.map((point) => new GeoJSON({type: 'Point', coordinates: [point.lng, point.lat]}))

    var jsonState = {}
    var viewKeys = Object.keys(view)
    Object.keys(state).forEach(function (key) {
      if (viewKeys.indexOf() < 0)jsonState[key] = state[key]
    })
    view.state = JSON.stringify(jsonState)

    await kvDb.put(kvDbClient, key, view)
    await diffUpdatedView(rawView, state)
    netClient.emit('POST_MUTATIONS', { id: view.id, mutations: mutations, dashId: view.dashId, toTags: view.toTags, toRoles: view.toRoles })
    return view
  } catch (error) { throw new Error(MODULE_NAME + 'problems during updateView ' + error) }
}

const getView = async function (id, view = null) {
  try {
    var key = new Key(aerospikeConfig.namespace, aerospikeConfig.set, id)
    if (!view) view = await kvDb.get(kvDbClient, key)
    if (!view) return null
    if (view.state) {
      var state = JSON.parse(view.state)
      var expandedView = Object.assign({}, view, state)
      delete expandedView.state
      return expandedView
    }
    return view
  } catch (error) { throw new Error('problems during getView ' + error) }
}

async function addTag (id, tag, meta) {
  var mutation = await mutate({data: tag, objId: id, mutation: 'addTag', meta})
  await updateView(id, [mutation])
}
async function removeTag (id, tag, meta) {
  var mutation = await mutate({data: tag, objId: id, mutation: 'removeTag', meta})
  await updateView(id, [mutation])
}
async function incrementDashPostNumber (dashId) {
  var op = Aerospike.operator
  var ops = [
    op.incr('count', 1),
    op.read('count')
  ]
  var dashPostsNumber = await kvDb.operate(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, dashId + '_meta'), ops)
  return dashPostsNumber
}
async function getUsersInfo (dashId, isPublic, toTags, toRoles) {
  CONSOLE.hl('Posts getUsersInfo', {dashId, isPublic, toTags, toRoles})
  var users = []
  if (isPublic)users = await subscriptions.listByDashId(dashId, ['userId', 'notifications'])
  else if (toTags || toRoles)users = await subscriptions.listByDashIdTagsRoles({dashId, tags: toTags, roles: toRoles, select: ['userId', 'notifications']})
  CONSOLE.hl('Posts getUsersInfo results', {users})
  return users
}
async function create (reqData, meta = {directCall: true}, getStream = null) {
  CONSOLE.hl('post create', reqData)
  var dashId = reqData.dashId
  var dashCounter = await incrementDashPostNumber(dashId)
  var id = dashId + '_' + dashCounter.count
  reqData.id = id
  // var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  // se lo user non è un admin (can "write") può inserire solo post a suo nome
  // if (reqData.userId && userId !== reqData.userId) await subscriptions.can(reqData.dashId, userId, 'writeOtherUsersPosts')
  // else {
  //   // await subscriptions.can(reqData.dashId, userId, 'writePosts')
  //   try {
  //     await subscriptions.can(reqData.dashId, userId, 'writePosts')
  //     reqData._confirmed = 1
  //   } catch (error) {
  //     await subscriptions.can(reqData.dashId, userId, 'confirmWritePosts')
  //     reqData._confirmed = 0
  //   }
  // }
  var subscription
  reqData.userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  try {
    subscription = await subscriptions.can(reqData.dashId, reqData.userId, 'writePosts')
    reqData._confirmed = 1
  } catch (error) {
    subscription = await subscriptions.can(reqData.dashId, reqData.userId, 'confirmWritePosts')
    reqData._confirmed = 0
  }
  reqData.subscriptionId = subscription.id
  if (reqData.tags)reqData.tags = reqData.tags.map((item) => item.replace('#', ''))
  CONSOLE.hl('dashPostCreate', reqData)
  var mutation = await mutate({data: reqData, objId: id, mutation: 'postsCreate', meta})
  var view = await updateView(id, [mutation], true)
  // var data = await postsRead(id, reqData.userId)
  if (!reqData._confirmed) await addToDashPostsToConfirmMeta(view.dashId, view.id)
  var users = await getUsersInfo(view.dashId, view.public, view.toTags, view.toRoles)
  CONSOLE.hl('dashPostCreate', view, users)
  netClient.emit('POST_CREATED', {view, users})
  return {success: MODULE_NAME + `created`, id, data: view}
}
// function checkToTags (to, tags, userId) {
//   var founded = false
//   for (var tag of tags) {
//     if (to.indexOf('#' + tag.replace('#', '')) >= 0)founded = true
//     if (to.indexOf('@' + userId) >= 0)founded = true
//   }
//   CONSOLE.hl('checkToTags', to, tags, userId, founded)
//   return founded
// }
async function read (reqData, meta = {directCall: true}, getStream = null) {
  var id = reqData.id
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  CONSOLE.hl('read userId', userId, meta)
  var currentState = await postsRead(id, userId, meta, true)
  if (!currentState) throw new Error('post not readable or deleted')
  // currentState.user = await netClient.rpc('readUser', {id: currentState.userId}, meta)
  return currentState
}
async function setReadedByUserMeta (id, userId) {
  var key = new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'PU_' + id + '_' + userId)
  var op = Aerospike.operator
  var ops = [
    op.listAppend('readed', Date.now()),
    op.listSize('readed')
  ]
  var res = await kvDb.operate(kvDbClient, key, ops) || {readed: 0}
  CONSOLE.hl('setReadedByUserMeta', res)
  return res.readed
}
async function getReadedByUserMeta (id, userId, countOnly = true) {
  var key = new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'PU_' + id + '_' + userId)
  var result
  if (countOnly)result = await kvDb.operate(kvDbClient, key, [Aerospike.operator.listSize('readed')])
  else result = await kvDb.operate(kvDbClient, key, [Aerospike.operator.read('readed')])
  return result.readed
}
function canBeRead (currentState, userId, subscription) {
  CONSOLE.hl('canBeRead', {currentState, userId, subscription})
  if (currentState.userId !== userId) {
    if ((currentState._deleted || !currentState._confirmed) && (!subscription || subscription.role.permissions.indexOf('readHiddenPosts') === -1)) {
      CONSOLE.hl('canBeRead', 'cant readHiddenPosts')
      return false
    } else if (!subscription || subscription.role.permissions.indexOf('postsReads') === -1) {
      CONSOLE.hl('canBeRead', 'cant postsReads')
      return false
    }
    if (!currentState.public) {
      if (!subscription || (!subscription.tags && !subscription.roleId)) {
        CONSOLE.hl('canBeRead', 'tags or roleId empty')
        return false
      }
      var toTagsIntersection = subscription.tags.filter((n) => currentState.toTags.includes(n)).length > 0
      var toRolesIntersection = currentState.toRoles.includes(subscription.roleId)
      if (!toTagsIntersection && !toRolesIntersection) {
        CONSOLE.hl('canBeRead', 'not have role or tag')
        return false
      }
    }
  }
  return true
}
async function exportCanBeRead (reqData, meta = {directCall: true}, getStream = null) {
  var func = canBeRead.toString()
  CONSOLE.hl('exportCanBeRead', {func})
  return {func}
}
async function exportMutations (reqData, meta = {directCall: true}, getStream = null) {
  var mutations = {}
  var files = fs.readdirSync(path.join(__dirname, '/mutations'))
  CONSOLE.hl('exportMutations', {files, mutations})
  files.forEach(function (file, index) {
    mutations[file] = require(path.join(__dirname, '/mutations/', file)).toString()
  })
  return mutations
}
async function postsRead (id, userId, meta, loadUser = false) {
  var currentState = await getView(id)
  if (!currentState) return null
  var subscription = await subscriptions.readByDashIdAndUserId({dashId: currentState.dashId, userId})
  CONSOLE.hl('postsRead currentState1', { id, userId, subscription, meta, loadUser, currentState })
  if (!canBeRead(currentState, userId, subscription)) return null
  currentState.subscription = await subscriptions.read({ id: currentState.subscriptionId, userId: currentState.userId, dashId: currentState.dashId, guestIfNull: true }, meta)
  if (loadUser)currentState.user = await netClient.rpc('readUser', {id: currentState.userId}, meta)
  if (loadUser)currentState.readedByUser = await setReadedByUserMeta(id, userId)
    // currentState.subscriptionId = subscription.id
  CONSOLE.hl('postsRead currentState2', { currentState })
  return currentState
}

async function update (reqData, meta = {directCall: true}, getStream = null) {
  var id = reqData.id
  var currentState = await getView(id)
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  if (userId !== currentState.userId) await subscriptions.can(currentState.dashId, userId, 'writeOtherUsersPosts')
  else if (!currentState._confirmed) await subscriptions.can(currentState.dashId, userId, 'confirmWritePosts')
  // else await subscriptions.can(currentState.dashId, userId, 'writePosts')
  if (reqData.tags)reqData.tags = reqData.tags.map((item) => item.replace('#', ''))
  var mutation = await mutate({data: reqData, objId: id, mutation: 'update', meta})
  var view = await updateView(id, [mutation])
  var users = await getUsersInfo(view.dashId, view.public, view.toTags, view.toRoles)
  netClient.emit('POST_UPDATED', {view, users})
  return {success: MODULE_NAME + `updated`}
}
async function addToDashPostsToConfirmMeta (dashId, id) {
  var key = new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, dashId + '_confirm')
  var meta = await kvDb.get(kvDbClient, key)
  if (!meta || !meta.items)meta = {items: []}
  CONSOLE.hl('addToDashPostsToConfirmMeta', {meta})
  meta.items.push(id)
  await kvDb.put(kvDbClient, key, meta)
}
async function removeFromDashPostsToConfirmMeta (dashId, id) {
  var key = new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, dashId + '_confirm')
  var meta = await kvDb.get(kvDbClient, key) || {items: []}
  CONSOLE.hl('removeFromDashPostsToConfirmMeta', {meta})
  meta.items.splice(meta.items.indexOf(id), 1)
  await kvDb.put(kvDbClient, key, meta)
}
async function getDashPostsToConfirmMeta (dashId) {
  var key = new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, dashId + '_confirm')
  var meta = await kvDb.get(kvDbClient, key) || {items: []}
  CONSOLE.hl('getDashPostsToConfirmMeta', {meta})
  return meta.items
}
async function confirm (reqData, meta = {directCall: true}, getStream = null) {
  var id = reqData.id
  var currentState = await getView(id)
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  await subscriptions.can(currentState.dashId, userId, 'postsConfirms')
  var mutation = await mutate({data: reqData, objId: id, mutation: 'postsConfirm', meta})
  var view = await updateView(id, [mutation])
  await removeFromDashPostsToConfirmMeta(view.dashId, view.id)
  return {success: MODULE_NAME + ` confirmed`}
}
async function remove (reqData, meta = {directCall: true}, getStream = null) {
  var id = reqData.id
  var currentState = await getView(id)
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  if (userId !== currentState.userId) await subscriptions.can(currentState.dashId, userId, 'writeOtherUsersPosts')
  // else await subscriptions.can(currentState.dashId, userId, 'writePosts')
  var mutation = await mutate({data: {}, objId: id, mutation: 'delete', meta})
  var view = await updateView(id, [mutation])
  var users = await getUsersInfo(view.dashId, view.public, view.toTags, view.toRoles)
  netClient.emit('POST_REMOVED', {view, users})
  return {success: MODULE_NAME + `removed`}
}
async function updatePic (reqData, meta = {directCall: true}, getStream = null) {
  var picId = reqData.id
  var postId = reqData.postId
  var dashId = reqData.dashId
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  var currentState = await getView(postId)
  if (currentState.userId !== userId) {
    try {
      await subscriptions.can(dashId, userId, 'writePosts')
    } catch (error) {
      await new Promise((resolve, reject) => fs.unlink(reqData.pic.path, (err, data) => err ? resolve(err) : resolve(data)))
      throw error
    }
  }
  var returnData = await pic.updatePic(aerospikeConfig, kvDbClient, picId, reqData.pic.path, CONFIG.uploadPath, [['mini', 100, 100]])
  return returnData
}
async function getPic (reqData, meta = {directCall: true}, getStream = null) {
  var returnData = await pic.getPic(aerospikeConfig, kvDbClient, reqData.id, reqData.size || 'mini')
  return returnData
}
async function addPic (reqData, meta = {directCall: true}, getStream = null) {
  var id = reqData.id
  var currentState = await getView(id)
  var postPics = currentState.pics || []
  var dashId = currentState.dashId
  var picId = uuid()
  await updatePic({id: picId, postId: id, pic: reqData.pic, dashId: dashId}, meta, getStream)
  postPics.push(picId)
  await update({id: id, pics: postPics}, meta, getStream)
  return {success: MODULE_NAME + `pic updated`}
}
async function removePic (reqData, meta = {directCall: true}, getStream = null) {
  var id = reqData.id
  var picId = reqData.picId
  var currentState = await getView(id)
  if (!currentState.pics || currentState.pics.indexOf(picId) < 0) {
    throw new Error(MODULE_NAME + ' pic no exists ' + picId)
  }
  var postPics = currentState.pics
  postPics.splice(postPics.indexOf(picId), 1)
  await update({id: id, pics: postPics}, meta, getStream)
  return {success: MODULE_NAME + `pic removed`}
}
async function queryByTimestamp (query = {}, meta = {directCall: true}, getStream = null) {
  // await auth.userCan('dashboard.read.query', meta, CONFIG.jwt)
  query = Object.assign({from: 0, to: 100000000000000}, query)
  var rawResults = await kvDb.query(kvDbClient, aerospikeConfig.namespace, aerospikeConfig.set, (dbQuery) => { dbQuery.where(Aerospike.filter.range('updated', query.from, query.to)) })
  var results = await Promise.all(rawResults.map((result) => getView(result.id, result)))
  return results
}

async function listLast (reqData = {}, meta = {directCall: true}, getStream = null) {
  var dashId = reqData.dashId
  var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
  await subscriptions.can(dashId, userId, 'postsReads')

  var dashPostsMeta = await getDashPostsMeta(dashId)
  var dashPostsNumber = dashPostsMeta ? dashPostsMeta.count : 0
  reqData = Object.assign({from: 0, to: 20}, reqData)
  var rawIds = []
  for (var i = reqData.from; i < reqData.to; i++) {
    rawIds.push(dashId + '_' + (dashPostsNumber - i))
  }
  CONSOLE.hl('listLast', dashId, dashPostsNumber, userId, rawIds)
  // return {}
  // await subscriptions.can(reqData.dashId, userId, 'postsReads')
  var results = await Promise.all(rawIds.map((id) => postsRead(id, userId, meta, true)))
  CONSOLE.hl('listLast results', results)
  return results.filter((post) => post !== null)
}
module.exports = {
  init: async function (setNetClient, setCONSOLE, setKvDbClient, setDashboards) {
    CONSOLE = setCONSOLE
    kvDbClient = setKvDbClient
    netClient = setNetClient
    dashboards = setDashboards
    // DB INDEXES
    // await kvDb.createIndex(kvDbClient, { ns: aerospikeConfig.namespace, set: aerospikeConfig.set, bin: 'created', index: aerospikeConfig.set + '_created', datatype: Aerospike.indexDataType.NUMERIC })
    // await kvDb.createIndex(kvDbClient, { ns: aerospikeConfig.namespace, set: aerospikeConfig.set, bin: 'updated', index: aerospikeConfig.set + '_updated', datatype: Aerospike.indexDataType.NUMERIC })

    var secondaryIndexLocation = await kvDb.get(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'secondaryIndexLocation'))
    if (!secondaryIndexLocation) {
      await kvDb.createIndex(kvDbClient, { ns: aerospikeConfig.namespace, set: aerospikeConfig.set, bin: 'location', index: aerospikeConfig.set + '_location', datatype: Aerospike.indexDataType.GEO2DSPHERE })
      await kvDb.put(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'secondaryIndexLocation'), {created: Date.now()})
    }
    var secondaryIndexUpdated = await kvDb.get(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'secondaryIndexUpdated'))
    if (!secondaryIndexUpdated) {
      await kvDb.createIndex(kvDbClient, { ns: aerospikeConfig.namespace, set: aerospikeConfig.set, bin: 'updated', index: aerospikeConfig.set + '_updated', datatype: Aerospike.indexDataType.NUMERIC })
      await kvDb.put(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'secondaryIndexUpdated'), {created: Date.now()})
    }
    var secondaryIndexCreated = await kvDb.get(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'secondaryIndexCreated'))
    if (!secondaryIndexCreated) {
      await kvDb.createIndex(kvDbClient, { ns: aerospikeConfig.namespace, set: aerospikeConfig.set, bin: 'created', index: aerospikeConfig.set + '_created', datatype: Aerospike.indexDataType.NUMERIC })
      await kvDb.put(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'secondaryIndexCreated'), {created: Date.now()})
    }
    CONSOLE.hl('INIT Secondary Index', {secondaryIndexLocation, secondaryIndexUpdated, secondaryIndexCreated})

    // setInterval(() => {
    //   CONSOLE.hl('EMIT TEST EVENT')
    //   netClient.emit('testRemoteEvent', {'testEvent': Date.now()})
    // }, 1000)
  },
  exportMutations,
  exportCanBeRead,
  getDashPostsMeta,
  getDashPostsToConfirmMeta,
  addPic,
  removePic,
  getPic,
  create,
  read,
  update,
  confirm,
  remove,
  updateView,
  getView,
  addTag,
  removeTag,
  queryByTimestamp,
  listLast
}
