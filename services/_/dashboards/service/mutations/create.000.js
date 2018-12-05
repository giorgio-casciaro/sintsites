module.exports = function (state, data) {
  state.pics = data.pics || {}
  state.id = data.id
  state.name = data.name
  state.description = data.description
  state.tags = data.tags || []
  state.maps = data.maps
  state.public = data.public || true
  state.roles = data.roles || {
    admin: { id: 'admin', name: 'Admin', public: 0, description: 'Main dashboard administrators', permissions: ['dashboardsWrite', 'dashboardsRead', 'dashboardsList', 'subscriptionsRead', 'subscriptionsReadAll', 'postsWrite', 'postsRead', 'postsConfirms', 'postsReadAll', 'postsWriteOtherUsers'] },
    postsAdmin: { id: 'postsAdmin', name: 'Posts Admin', public: 0, description: 'Dashboard posts admin', permissions: ['dashboardsRead', 'postsWrite', 'postsRead', 'postsWriteOtherUsers', 'postsConfirms', 'postsRead', 'subscriptionsRead', 'subscriptionsReadAll'] },
    subscriber: { id: 'subscriber', name: 'Subscriber', public: 1, description: 'Dashboard subscribers', permissions: ['dashboardsRead', 'postsRead', 'subscriptionsRead'] },
    guest: { id: 'guest', name: 'Guest', public: 0, description: 'Dashboard guests, No Role', permissions: [] }
  }
  state.options = data.options || {
    guestRead: 'allow',
    guestSubscribe: 'allow',
    guestWrite: 'confirm',
    subscriberWrite: 'allow'
  }
  return state
}
