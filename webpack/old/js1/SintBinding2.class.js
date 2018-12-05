function log () {
  console.log.apply(
    console,
    ['/ SintBinding / '].concat(Array.from(arguments))
  )
}
var sintBindingsDb = new WeakMap()
class SintBinding {
  constructor (obj, prop, logData) {
    // if (!obj.prototype.__bindings)obj.prototype.__bindings = {}
    // var thisBindings = obj.prototype.__bindings[obj] || {}
    // thisBindings[prop] = true
    var _this = this
    this.obj = obj
    this.prop = prop
    log('SintBinding  ', obj, prop, logData)
    if (obj[prop].push) {
      obj[prop].push = function () {
        Array.prototype.push.apply(obj[prop], arguments)
        _this.execListeners()
      }
    }
    var dbObj = sintBindingsDb.get(obj)
    if (dbObj && dbObj[prop]) {
      log('SintBinding obj[prop] instanceof SintBinding ')
      return this
    }
    if (!dbObj) dbObj = {}
    if (!dbObj[this.prop]) {
      dbObj[this.prop] = { value: obj[prop], listeners: [] }
      Object.defineProperty(obj, prop, {
        get: () => _this.valueOf(),
        set: value => _this.set(value)
      })
      sintBindingsDb.set(obj, dbObj)
    }
  }
  addListener (listener, view) {
    log('Binding addListener', listener)
    var dbObj = sintBindingsDb.get(this.obj)
    dbObj[this.prop].listeners.push([listener, view])
  }
  addBinding (params, updateAction, view) {
    log('Binding addBinding', this, params, view)
    this.addListener(updateAction, view)
    Object.defineProperty(params, this.prop, {
      get: () => this.valueOf(),
      set: value => {
        log('Binding set', this, params, value)
        this.set(value)
      }
    })
  }
  execListeners () {
    var dbObj = sintBindingsDb.get(this.obj)
    log('execListeners', dbObj)
    dbObj[this.prop].listeners.forEach(listener => {
      log('execListener', listener)
      listener[0]()
    }
    )
  }
  toString () {
    return this.valueOf()
  }
  valueOf () {
    var dbObj = sintBindingsDb.get(this.obj)
    return dbObj[this.prop].value
  }
  set (value) {
    var dbObj = sintBindingsDb.get(this.obj)
    dbObj[this.prop].value = value
    this.execListeners()
  }
}
if (typeof module !== 'undefined') {
  module.export = Binding
}
