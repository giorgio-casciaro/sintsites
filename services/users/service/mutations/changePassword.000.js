module.exports = {
  fieldsWrite: ['password'],
  fieldsRead: [],
  exec: function (state, data) {
    state.password = data.password
    return state
  }
}
