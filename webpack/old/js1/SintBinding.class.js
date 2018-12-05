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
    this.logData = logData
    log('SintBindingMain  ', logData, obj, prop)
    if (obj[prop].push) {
      obj[prop].push = function () {
        Array.prototype.push.apply(obj[prop], arguments)
        _this.execListenersSet()
      }
    }
    this.originalProp = obj[prop]
    this.propertyDescriptorBeforeChanges = Object.getOwnPropertyDescriptor(obj, prop)

    Object.defineProperty(obj, prop, {
      get: () => this.valueOf(),
      set: (value) => { if (this.paramsView) this.paramsView[this.paramsName] = value; this.set(value) }
    })
  }
  addBinding (params, paramName, getAction, setAction, view) {
    this.paramsView = params
    this.paramsName = paramName
    log('BindingAddBinding', this, params, view)
    this.listeners.push([getAction, setAction, view])
    // var propertyDescriptorBeforeChanges = Object.getOwnPropertyDescriptor(params, this.prop)
    Object.defineProperty(params, paramName, {
      get: () => this.valueOf(),
      set: (value) => { log('addBinding set', this); this.set(value) }
    })
  }
  execListenersSet () {
    log('execListenersSet', this)
    this.listeners.forEach(listener => {
      if (listener[1])listener[1]()
    })
  }
  execListenersGet () {
    log('execListenersGet', this)
    this.listeners.forEach(listener => {
      if (listener[0])listener[0]()
    })
  }
  toString () {
    return this.valueOf()
  }
  valueOf () {
    var value
    if (this.propertyDescriptorBeforeChanges && this.propertyDescriptorBeforeChanges.get) value = this.propertyDescriptorBeforeChanges.get()
    else value = this.originalProp
    this.execListenersGet()
    return value
  }
  set (value) {
    log('SintBinding set ', { 'binding': this, value })
    if (this.propertyDescriptorBeforeChanges && this.propertyDescriptorBeforeChanges.set) this.propertyDescriptorBeforeChanges.set(value)
    this.originalProp = value
    this.execListenersSet()
  }
}
if (typeof module !== 'undefined') {
  module.export = Binding
}
