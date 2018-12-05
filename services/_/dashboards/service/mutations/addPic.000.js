 module.exports = function (state, data) {
   state.pics[data.pic.picId] = data.pic
   return state
 }
