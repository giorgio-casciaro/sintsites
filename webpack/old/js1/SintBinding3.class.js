function log () {
  console.log.apply(
    console,
    ['/ SintBinding / '].concat(Array.from(arguments))
  )
}
class SintBinding {
  constructor (obj, prop, logData) {
    // if (!obj.prototype.__bindings)obj.prototype.__bindings = {}
    // var thisBindings = obj.prototype.__bindings[obj] || {}
    // thisBindings[prop] = true
    var _this = this
    this.listeners = []
    this.obj = obj
    this.prop = prop
    log('SintBinding  ', logData, obj, prop)
    if (obj[prop].push) {
      obj[prop].push = function () {
        Array.prototype.push.apply(obj[prop], arguments)
        _this.execListeners()
      }
    }
    this.originalProp = obj[prop]
    var propertyDescriptor = Object.getOwnPropertyDescriptor(obj, prop)
    Object.defineProperty(obj, prop, {
      get: () => { return this.valueOf() },
      set: value => {
        log('SintBinding set ', { logData, obj, prop, value })
        if (propertyDescriptor.set)propertyDescriptor.set(value); _this.set(value)
      }
    })
  }
  addListener (listener, view) {
    log('Binding addListener', listener)
    this.listeners.push([listener, view])
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
    log('execListeners')
    this.listeners.forEach(listener => {
      log('execListener', listener)
      listener[0]()
    }
    )
  }
  toString () {
    return this.valueOf()
  }
  valueOf () {
    return this.originalProp
  }
  set (value) {
    this.originalProp = value
    this.execListeners()
  }
}
if (typeof module !== 'undefined') {
  module.export = Binding
}
