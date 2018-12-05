 module.exports = function (state, data) {
   delete state.pics[data.picId]
   return state
 }
