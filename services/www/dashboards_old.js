// var MongoClient = require('mongodb').MongoClient
process.on('unhandledRejection', (err, p) => {
  console.log('An unhandledRejection occurred')
  console.log(`Rejected Promise: ${p}`)
  console.log(`Rejection: ${err}`)
})

const path = require('path')
const uuid = require('uuid/v4')

const Aerospike = require('aerospike')
const Key = Aerospike.Key
const kvDb = require('sint-bit-utils/utils/kvDb')
const pic = require('sint-bit-utils/utils/pic')
const metaUtils = require('sint-bit-utils/utils/meta')

const nodemailer = require('nodemailer')
const vm = require('vm')
const fs = require('fs')

const auth = require('sint-bit-utils/utils/auth')
var kvDbClient

const posts = require('./posts')
const subscriptions = require('./subscriptions')
var methods
var service = function getMethods (CONSOLE, netClient, CONFIG = require('./config')) {
  try {
    CONSOLE.debug('CONFIG', CONFIG)
    CONSOLE.log('CONFIG', CONFIG)
    var aerospikeConfig = CONFIG.aerospike.dashboards
    // SMTP
    var smtpTrans = nodemailer.createTransport(require('./config').smtp)
    const getMailTemplate = async (template, sandbox = { title: 'title', header: 'header', body: 'body', footer: 'footer' }, ext = '.html') => {
      var populate = (content) => vm.runInNewContext('returnVar=`' + content.replace(new RegExp('`', 'g'), '\\`') + '`', sandbox)
      var result = await new Promise((resolve, reject) => fs.readFile(path.join(__dirname, '/emails/', template + ext), 'utf8', (err, data) => err ? reject(err) : resolve(populate(data))))
      return result
    }
    const sendMail = async (template = 'dashboardCreated', mailOptions, mailContents) => {
      mailOptions.html = await getMailTemplate(template, mailContents, '.html')
      mailOptions.txt = await getMailTemplate(template, mailContents, '.txt')
      CONSOLE.log('sendMail', mailOptions)
      if (!process.env.sendEmails) return true
      return await new Promise((resolve, reject) => smtpTrans.sendMail(mailOptions, (err, data) => err ? reject(err) : resolve(data)))
    }

    // INIT
    //
    const init = async function () {
      try {
        kvDbClient = await kvDb.getClient(aerospikeConfig)
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
        CONSOLE.hl('INIT Secondary Index', { secondaryIndexUpdated, secondaryIndexCreated })
        await subscriptions.init(netClient, CONSOLE, kvDbClient, methods)
        await posts.init(netClient, CONSOLE, kvDbClient, methods)
      } catch (error) {
        CONSOLE.hl('problems during init', error)
        throw new Error('problems during init')
      }
    }
    // DASHBOARDS
    var mutationsPack = require('sint-bit-cqrs/mutations')({ mutationsPath: path.join(__dirname, '/mutations') })
    const mutate = async function (args) {
      try {
        var mutation = mutationsPack.mutate(args)
        CONSOLE.debug('mutate', mutation)
        var key = new Key(aerospikeConfig.namespace, aerospikeConfig.mutationsSet, mutation.id)
        await kvDb.put(kvDbClient, key, mutation)
        return mutation
      } catch (error) {
        throw new Error('problems during mutate a ' + error)
      }
    }
    async function diffUpdatedView (oldState, newState) {
      var oldTags = oldState.tags ? oldState.tags : []
      var newTags = newState.tags ? newState.tags : []
      var op = Aerospike.operator
      var ops = []

      // REMOVED TAGS
      var removedTags = oldTags.filter(x => newTags.indexOf(x) < 0)
      ops = ops.concat(removedTags.map((tag) => op.incr('#' + tag, -1)))
      // ADDED TAGS
      var addedTags = newTags.filter(x => oldTags.indexOf(x) < 0)
      ops = ops.concat(addedTags.map((tag) => op.incr('#' + tag, 1)))
      CONSOLE.hl('diffUpdatedView', oldTags, newTags, removedTags, addedTags)
      CONSOLE.hl('diffUpdatedView ops', ops)

      await kvDb.operate(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'dashboards_meta'), ops)
    }
    const updateView = async function (id, mutations, isNew, set) {
      try {
        var key = new Key(aerospikeConfig.namespace, set || aerospikeConfig.set, id)
        var rawView = await getView(id, null, false) || {state: {}}
        var state = mutationsPack.applyMutations(rawView.state, mutations)
        var view = {
          updated: Date.now(),
          created: rawView.created || Date.now(),
          // email: state.email || '',
          id: state.id,
          tags: state.tags || [],
          state: JSON.stringify(state)
        }
        await kvDb.put(kvDbClient, key, view)
        await diffUpdatedView(rawView.state, state)
        return view
      } catch (error) { throw new Error('problems during updateView ' + error) }
    }

    const getView = async function (id, view = null, stateOnly = true) {
      try {
        var key = new Key(aerospikeConfig.namespace, aerospikeConfig.set, id)
        if (!view) view = await kvDb.get(kvDbClient, key)
        if (!view) return null
        if (view.state)view.state = JSON.parse(view.state)
        if (stateOnly) return view.state
        return view
      } catch (error) { throw new Error('problems during getView ' + error) }
    }
    const addTag = async function (id, tag, meta) {
      var mutation = await mutate({data: tag, objId: id, mutation: 'addTag', meta})
      await updateView(id, [mutation])
    }
    const removeTag = async function (id, tag, meta) {
      var mutation = await mutate({data: tag, objId: id, mutation: 'removeTag', meta})
      await updateView(id, [mutation])
    }
    async function incrementDashboardsMetaCount () {
      var op = Aerospike.operator
      var ops = [
        op.incr('count', 1),
        op.read('count')
      ]
      var count = await kvDb.operate(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'dashboards_meta'), ops)
      return count
    }
    async function getDashboardsMeta () {
      var dashboardsMeta = await kvDb.get(kvDbClient, new Key(aerospikeConfig.namespace, aerospikeConfig.metaSet, 'dashboards_meta'))
      return dashboardsMeta
    }
    async function getDashInfo (id) {
      var currentState = await getView(id)
      CONSOLE.hl('getDashInfo', {id, currentState})
      if (!currentState || currentState._deleted) return null
      return {id: currentState.id, name: currentState.name, description: currentState.description, options: currentState.options, tags: currentState.tags, pics: currentState.pics || []}
    }
    const extendDashRoles = async function (currentState) {
      for (var roleId in currentState.roles) {
        var role = currentState.roles[roleId]
        var rolePermissions = role.permissions
        if (role.id === 'guest' && currentState.options.guestRead === 'allow') {
          rolePermissions.push('postsReads')
          rolePermissions.push('subscriptionsRead')
          rolePermissions.push('readDashboard')
        }
        if (role.id === 'guest' && currentState.options.guestSubscribe === 'allow') {
          rolePermissions.push('subscribe')
        }
        if (role.id === 'guest' && currentState.options.guestSubscribe === 'confirm') {
          rolePermissions.push('confirmSubscribe')
        }
        if (role.id === 'guest' && currentState.options.guestWrite === 'allow') {
          rolePermissions.push('writePosts')
        }
        if (role.id === 'guest' && currentState.options.guestWrite === 'confirm') {
          rolePermissions.push('confirmWritePosts')
        }
        if (role.id === 'subscriber' && currentState.options.subscriberWrite === 'allow') {
          rolePermissions.push('writePosts')
        }
        if (role.id === 'subscriber' && currentState.options.subscriberWrite === 'confirm') {
          rolePermissions.push('confirmWritePosts')
        }
      }
    }
    const getDashRole = async function (roleId, dashId, currentState) {
      try {
        CONSOLE.hl('getDashRole roleId, dashId, currentState', roleId, dashId, currentState)

        if (!currentState) currentState = await readDashboard(dashId)
        if (!currentState || !currentState.roles || !currentState.roles[roleId]) throw new Error(`role not founded: dash id ${dashId}, role id ${roleId}`)
        return currentState.roles[roleId]
      } catch (error) { throw new Error('problems during getDashRole ' + error) }
    }

    // const getDashRoles = async function (dashId) {
    //   try {
    //     var currentState = await getView(dashId)
    //     if (currentState && currentState.roles) return currentState.roles.map((role) => getDashRole(role.id, dashId, currentState))
    //     return []
    //   } catch (error) { throw new Error('problems during getDashRoles ' + error) }
    // }

    const readDashboard = async function (id) {
      var currentState = await getView(id)
      if (!currentState || currentState._deleted) {
        throw new Error('dashboard not active')
      }
      extendDashRoles(currentState)
      return currentState
    }

    methods = {
      init,
      async getDashboardRole (reqData, meta = {directCall: true}, getStream = null) {
        CONSOLE.hl('getDashRole reqData', reqData)
        if (!reqData.currentState) reqData.currentState = await readDashboard(reqData.dashId)
        CONSOLE.hl('getDashRole reqData.currentState.roles', reqData.currentState.roles)
        if (!reqData.currentState || !reqData.currentState.roles || !reqData.currentState.roles[reqData.roleId]) throw new Error(`role not founded: dash id ${reqData.dashId}, role id ${reqData.roleId}`)
        CONSOLE.hl('getDashRole reqData.currentState.roles[reqData.roleId]', reqData.currentState.roles[reqData.roleId])
        return reqData.currentState.roles[reqData.roleId]
      },
      async getPermissions (reqData, meta = {directCall: true}, getStream = null) {
        // recuperare iscrizioni
        return { permissions: [ [10, 'dashboard.create', 1], [10, 'dashboard.read', 1] ] }
      },
      async create (reqData, meta = {directCall: true}, getStream = null) {
        var dashboardsMeta = await incrementDashboardsMetaCount()
        var id = dashboardsMeta.count
        reqData.id = id
        await auth.userCan('dashboard.create', meta, CONFIG.jwt)
        if (reqData.tags)reqData.tags = reqData.tags.map((item) => item.replace('#', ''))
        var mutation = await mutate({data: reqData, objId: id, mutation: 'create', meta})
        var roleAdmin = { id: 'admin', name: 'Admin', public: 0, description: 'Main dashboard administrators', permissions: ['unsubscribe', 'writeDashboard', 'readDashboard', 'writeSubscriptions', 'subscriptionsRead', 'subscriptionsReads', 'subscriptionsReadAll', 'writeRoles', 'readRoles', 'writePosts', 'postsReads', 'postsConfirms', 'readHiddenPosts', 'writeOtherUsersPosts' ] }
        var mutationRoleAdmin = await mutate({data: roleAdmin, objId: id, mutation: 'addRole', meta})
        var rolePostAdmin = { id: 'postsAdmin', name: 'Posts Admin', public: 0, description: 'Dashboard posts admin', permissions: ['unsubscribe', 'readDashboard', 'writePosts', 'postsReads', 'postsConfirms', 'readHiddenPosts', 'subscriptionsRead', 'subscriptionsReadAll', 'readRoles', 'writeOtherUsersPosts'] }
        var mutationRolePostsAdmin = await mutate({data: rolePostAdmin, objId: id, mutation: 'addRole', meta})
        var roleSubscriber = { id: 'subscriber', name: 'Subscriber', public: 1, description: 'Dashboard subscribers', permissions: ['unsubscribe', 'readDashboard', 'postsReads', 'subscriptionsRead', 'readRoles'] }
        var mutationRoleSubscriber = await mutate({data: roleSubscriber, objId: id, mutation: 'addRole', meta})
        var roleGuest = { id: 'guest', name: 'Guest', public: 0, description: 'Dashboard guests, No Role', permissions: [] }
        var mutationRoleGuest = await mutate({data: roleGuest, objId: id, mutation: 'addRole', meta})
        await updateView(id, [mutation, mutationRoleAdmin, mutationRolePostsAdmin, mutationRoleSubscriber, mutationRoleGuest], true)

        var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)

        var subscription = { dashId: id, roleId: 'admin', userId, tags: ['admin'], meta: {confirmed: true} }
        var createAdminSubscription = await subscriptions.createRaw(subscription, meta)
        CONSOLE.hl('createDashboard createAdminSubscription', {createAdminSubscription})
        return {success: `Dashboard created`, id}
      },
      async info (reqData, meta = {directCall: true}, getStream = null) {
        var id = reqData.id
        await auth.userCan('dashboard.read', meta, CONFIG.jwt)
        var returnResults = await getDashInfo(id)
        return returnResults
      },
      async update (reqData, meta = {directCall: true}, getStream = null) {
        var id = reqData.id
        var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
        await subscriptions.can(id, userId, 'writeDashboard')
        if (reqData.tags)reqData.tags = reqData.tags.map((item) => item.replace('#', ''))
        var mutation = await mutate({data: reqData, objId: id, mutation: 'update', meta})
        await updateView(id, [mutation])
        return {success: `Dashboard updated`}
      },
      async read (reqData, meta = {directCall: true}, getStream = null) {
        var id = reqData.id
        var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
        await subscriptions.can(id, userId, 'readDashboard')
        var currentState = await readDashboard(id)
        // currentState.subscriptionsMeta = metaUtils.optimize(await subscriptions.getDashMeta(id))
        // currentState.subscriptionsToConfirmMeta = await subscriptions.getDashSubscriptionsToConfirmMeta(id)
        currentState.postsMeta = metaUtils.optimize(await posts.getDashPostsMeta(id))
        currentState.postsToConfirmMeta = await posts.getDashPostsToConfirmMeta(id)
        CONSOLE.hl('read currentState', currentState)
        return currentState
      },
      async remove (reqData, meta = {directCall: true}, getStream = null) {
        var id = reqData.id
        var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
        await subscriptions.can(id, userId, 'writeDashboard')
        var mutation = await mutate({data: {}, objId: id, mutation: 'delete', meta})
        await updateView(id, [mutation])
        return {success: `Dashboard removed`}
      },
      async updatePic (reqData, meta = {directCall: true}, getStream = null) {
        var id = reqData.id
        try {
          var userId = await auth.getUserIdFromToken(meta, CONFIG.jwt)
          await subscriptions.can(id, userId, 'writeDashboard')
        } catch (error) {
          await new Promise((resolve, reject) => fs.unlink(reqData.pic.path, (err, data) => err ? resolve(err) : resolve(data)))
          throw error
        }
        var picId = uuid()
        var returnResults = await pic.updatePic(aerospikeConfig, kvDbClient, picId, reqData.pic.path, CONFIG.uploadPath, [['mini', 100, 100], ['medium', 500, 500]])
        var mutation = await mutate({data: {picId}, objId: id, mutation: 'addPic', meta})
        var view = await updateView(id, [mutation])
        // CONSOLE.hl('updatePic', view)
        return returnResults
      },
      async getPic (reqData, meta = {directCall: true}, getStream = null) {
        // CONSOLE.hl('getPic', reqData)
        var returnResults = await pic.getPic(aerospikeConfig, kvDbClient, reqData.id, reqData.size || 'mini')
        return returnResults
      },
      async queryByTimestamp (query = {}, meta = {directCall: true}, getStream = null) {
        // await auth.userCan('dashboard.read.query', meta, CONFIG.jwt)
        query = Object.assign({from: 0, to: 100000000000000}, query)
        var rawResults = await kvDb.query(kvDbClient, aerospikeConfig.namespace, aerospikeConfig.set, (dbQuery) => { dbQuery.where(Aerospike.filter.range('updated', query.from, query.to)) })
        var results = await Promise.all(rawResults.map((result) => getView(result.id, result)))
        return results
      },
      async listLastDashboards (reqData = {}, meta = {directCall: true}, getStream = null) {
        var dashboardsMeta = await getDashboardsMeta()
        CONSOLE.hl('listLastDashboards', dashboardsMeta)
        if (!dashboardsMeta || !dashboardsMeta.count) return []
        reqData = Object.assign({from: 0, to: 20}, reqData)
        var rawIds = []
        for (var i = reqData.from; i < reqData.to; i++) {
          rawIds.push(dashboardsMeta.count - i)
        }
        CONSOLE.hl('listLastDashboards', dashboardsMeta, rawIds)
        var results = await Promise.all(rawIds.map((id) => getDashInfo(id)))
        return results.filter((post) => post !== null)
      },
      async getDashboardsMeta (reqData = {}, meta = {directCall: true}, getStream = null) {
        var dashboardsMeta = metaUtils.optimize(await getDashboardsMeta())
        CONSOLE.hl('getDashboardsMeta', dashboardsMeta)
        return dashboardsMeta
      },
      async listPopular (query = {}, meta = {directCall: true}, getStream = null) {
      },
      async listActive (query = {}, meta = {directCall: true}, getStream = null) {
      },
      readDashboard,
      getDashRole,
      getDashboardInfo (reqData = {}, meta = {directCall: true}, getStream = null) { return getDashInfo(reqData.id) },
      async test (query = {}, meta = {directCall: true}, getStream = null) {
        var results = await require('./tests/base.test')(netClient)
        CONSOLE.log('test results', results)
        return results
      }
    }
    for (var postsMethod in posts) {
      methods['posts' + postsMethod[0].toUpperCase() + postsMethod.substr(1)] = posts[postsMethod]
    }
    for (var subscriptionsMethod in subscriptions) {
      methods['subscriptions' + subscriptionsMethod[0].toUpperCase() + subscriptionsMethod.substr(1)] = subscriptions[subscriptionsMethod]
    }
    return methods
  } catch (error) {
    CONSOLE.hl('ERROR', error)
    CONSOLE.error('getMethods', error)
    return { error: 'getMethods error' }
  }
}

module.exports = service
