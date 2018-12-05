
export default class SintTemplate {
  constructor (data) {
    if (!data) throw new Error('TEMPLATE NOT VALID')
    Object.assign(this, data)
  }
  log () { console.log.apply(console, ['/ SintTemplate / '].concat(Array.from(arguments))) }
}
