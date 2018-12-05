 module.exports = function (state, data) {
   if (!state.tags)state.tags = []
   if (!data.tags)data.tags = []
   data.tags.forEach(tag => { if (state.tags.indexOf(tag) === -1)state.tags.push(tag) })
   return state
 }
