module.exports = {
  fieldsWrite: ['pics'],
  fieldsRead: [],
  exec: function (state, data) {
    delete state.pics[data.picId]
    return state
  }
}
