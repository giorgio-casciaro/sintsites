module.exports = function (state, data) {
  // state.status = 0
  state.publicName = data.publicName || data.email ? data.email.split('@')[0] : ''
  state.personalInfo = data.personalInfo || {}
  state.password = data.password
  state.logins = 0
  state.permissions = []
  state.notifications = data.notifications || {email: true, sms: true, facebook: true}
  state.pics = {}
  state.logouts = 0
  state.id = data.id
  state.email = data.email
  state.emailConfirmationCode = data.emailConfirmationCode
  state.emailConfirmed = false
  return state
}
