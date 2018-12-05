module.exports = {
  fieldsWrite: ['emailConfirmed'],
  fieldsRead: [],
  exec: function (state, data) {
    state.emailConfirmed = true
    return state
  }
}
