module.exports = {
  fieldsWrite: ['pics'],
  fieldsRead: [],
  exec: function (state, data) {
    state.pics[data.pic.picId] = data.pic
    return state
  }
}
