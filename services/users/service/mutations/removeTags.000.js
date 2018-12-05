module.exports = {
  fieldsWrite: ['tags'],
  fieldsRead: [],
  exec: function (state, data) {
    if (!state.tags)state.tags = []
    if (!data.tags)data.tags = []
    data.tags.forEach(tag => { var index = state.tags.indexOf(tag); if (index > -1) state.tags.splice(index, 1) })
    return state
  }
}
