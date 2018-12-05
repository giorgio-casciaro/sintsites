function log () { console.log.apply(console, ['/ SintBinding / '].concat(Array.from(arguments))) }
var sintBindingsDb = {}
class SintBinding {
  constructor (obj, prop) {
    // if (!obj.prototype.__bindings)obj.prototype.__bindings = {}
    // var thisBindings = obj.prototype.__bindings[obj] || {}
    // thisBindings[prop] = true
    var _this = this
    this.obj = obj
    this.prop = prop
    log('SintBinding  ', obj, prop)
    if (obj[prop].push) {
      obj[prop].push = function () {
        Array.prototype.push.apply(obj[prop], arguments)
        _this.execListeners()
      }
    }
  }
  addListener (listener) {
    log('Binding addListener', listener)
    sintBindingsDb[this.obj][this.prop].listeners.push(listener)
  }
  execListeners () {
    log('execListeners', sintBindingsDb[this.obj][this.prop])
    sintBindingsDb[this.obj][this.prop].listeners.forEach(listener => listener())
  }
  toString () {
    return sintBindingsDb[this.obj][this.prop].value
  }
  valueOf () {
    return sintBindingsDb[this.obj][this.prop].value
  }
  set (value) {
    sintBindingsDb[this.obj][this.prop].value = value
    this.execListeners()
  }
}
if (typeof module !== 'undefined') {
  module.export = Binding
}
