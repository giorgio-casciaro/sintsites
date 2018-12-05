
class SintBinding {
  constructor (obj, prop, logData) {
    var _this = this
    this.listeners = []
    this.obj = obj
    this.prop = prop
    this.logData = logData
    this.originalProp = obj[prop]
    this.propertyDescriptorBeforeChanges = Object.getOwnPropertyDescriptor(obj, prop)
    if (obj[prop].push) {
      obj[prop].push = function () {
        Array.prototype.push.apply(obj[prop], arguments)
        _this.execListenersSet()
      }
    }
    Object.defineProperty(obj, prop, {
      get: () => this.valueOf(),
      set: (value) => { if (this.paramsView) this.paramsView[this.paramsName] = value; this.set(value) }
    })
  }
  log () {
    console.log.apply(console, ['/ SintBinding / '].concat(Array.from(arguments)))
  }
  addBinding (params, paramName, getAction, setAction, view) {
    this.paramsView = params
    this.paramsName = paramName
    this.listeners.push([getAction, setAction, view])
    Object.defineProperty(params, paramName, {
      get: () => this.valueOf(),
      set: (value) => { this.set(value) }
    })
  }
  execListenersSet () {
    this.listeners.forEach(listener => {
      if (listener[1])listener[1]()
    })
  }
  execListenersGet () {
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
    if (this.propertyDescriptorBeforeChanges && this.propertyDescriptorBeforeChanges.set) this.propertyDescriptorBeforeChanges.set(value)
    this.originalProp = value
    this.execListenersSet()
  }
}
if (typeof module !== 'undefined') {
  module.export = Binding
}
