function log () { console.log.apply(console, ['/ SintTemplate / '].concat(Array.from(arguments))) }
class SintTemplate {
  constructor (data) {
    log('SintTemplate', data)
    if (!data) throw new Error('TEMPLATE NOT VALID')
    Object.assign(this, data)
    log('SintTemplate', this)
  }
}
if (typeof module !== 'undefined') module.export = SintTemplate
