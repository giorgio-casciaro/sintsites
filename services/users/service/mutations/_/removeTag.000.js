module.exports = function (state, tag) {
  if (state.tags) delete state.tags[state.tags.indexOf(tag)]
  return state
}
