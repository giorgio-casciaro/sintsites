 module.exports = function (state, tag) {
   if(!state.tags)state.tags=[]
   state.tags.push(tag)
   return state
 }
