module.exports = {
  fieldsWrite: ['deleted'],
  fieldsRead: [],
  exec: function (state, data) {
    state.deleted = true
    return state
  }
}
