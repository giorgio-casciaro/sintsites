module.exports = {
  fieldsWrite: ['status'],
  fieldsWrite: ['status'],
  fieldsWrite: ['status'],
  exec: function (state, data) {
    return Object.assign({}, data, {status: 2})
  }
}
