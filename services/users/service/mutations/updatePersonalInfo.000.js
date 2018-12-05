module.exports = {
  fieldsWrite: ['firstName', 'lastName', 'birth', 'publicName'],
  fieldsRead: [],
  exec: function (state, data) {
    state.firstName = data.firstName
    state.lastName = data.lastName
    state.birth = data.birth
    state.publicName = data.publicName
    return state
  }
}
