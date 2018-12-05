module.exports = {
  fieldsWrite: '*',
  fieldsRead: [],
  exec: function (state, data) {
    state.id = data.id
    state.password = data.password
    state.publicName = data.publicName || data.email.split('@')[0]
    state.email = data.email
    state.info = data.info
    state.guest = true
    state.tags = []
    return state
  }
}
