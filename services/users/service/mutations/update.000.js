module.exports = {
  fieldsWrite: '*',
  fieldsRead: [],
  exec: function (state, data) {
    return Object.assign({}, state, data)
  }
}
