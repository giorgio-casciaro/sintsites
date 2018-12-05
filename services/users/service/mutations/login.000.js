module.exports = {
  fieldsWrite: ['logins'],
  fieldsRead: [],
  exec: function (state, data) {
    state.logins++
    return state
  }
}
