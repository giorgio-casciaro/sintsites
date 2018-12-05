function log () { console.log.apply(console, ['/ SintBinding / '].concat(Array.from(arguments))) }

class SintBinding {
  constructor (obj, prop) {
    // if (!obj.prototype.__bindings)obj.prototype.__bindings = {}
    // var thisBindings = obj.prototype.__bindings[obj] || {}
    // thisBindings[prop] = true
    var _this = this
    this.obj = obj
    this.prop = prop
    if (obj[prop].push) {
      obj[prop].push = function () {
        Array.prototype.push.apply(obj[prop], arguments)
        _this.execListeners()
      }
    }
    if (!obj.___bindings) obj.___bindings = {}
    if (!obj.___bindings[prop]) {
      obj.___bindings[prop] = { value: obj[prop], listeners: [] }
      Object.defineProperty(obj, prop, {
        get: () => obj.___bindings[prop].value,
        set: value => {
          console.log('Binding set', value)
          _this.set(value)
        }
      })
    }
  }
  addListener (listener) {
    console.log('Binding addListener', listener)
    this.obj.___bindings[this.prop].listeners.push(listener)
  }
  execListeners () {
    this.obj.___bindings[this.prop].listeners.forEach(listener => listener())
  }
  toString () {
    return this.obj[this.prop]
  }
  valueOf () {
    return this.obj[this.prop]
  }
  set (value) {
    this.obj.___bindings[this.prop].value = value
    this.execListeners()
  }
}
if (typeof module !== 'undefined') {
  module.export = Binding
}
