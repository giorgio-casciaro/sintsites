module.exports = function (state, data) {
  state.id = data.id
  state.objectId = data.objectId
  state.objectType = data.objectType
  state.userId = data.userId
  state.channels = data.channels
  state.sendsInfo = {}
  state.toSend = data.toSend || true
  state.toSendInfo = data.toSendInfo || {}
  return state
}
