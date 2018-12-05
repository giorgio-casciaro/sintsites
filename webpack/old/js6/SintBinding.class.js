
class SintBinding {
  constructor (obj, prop, logData) {
    this.listeners = []
    this.obj = obj
    this.prop = prop
    // this.logData = logData
  }
  log () {
    console.log.apply(console, ['/ SintBinding / '].concat(Array.from(arguments)).concat([this]))
  }
  addBinding (connectedObj, connectedObjProp, getAction, setAction, view) {
    var objValue = this.value = this.obj[this.prop]
    var connectedObjValue = connectedObj[connectedObjProp] = objValue
    this.listeners.push([getAction, setAction, view])

    var objPropertyDescriptor = Object.getOwnPropertyDescriptor(this.obj, this.prop)
    Object.defineProperty(this.obj, this.prop, {
      get: () => {
        // this.log('defineProperty Obj  GET', objValue, //this.logData)
        if (objPropertyDescriptor && objPropertyDescriptor.get) objPropertyDescriptor.get()
        this.execListenersGet()
        return objValue
      },
      set: (value) => {
        // this.log('defineProperty Obj  SET', value, //this.logData)
        if (objPropertyDescriptor && objPropertyDescriptor.set)objPropertyDescriptor.set(value)
        objValue = value
        if (connectedObjValue !== value)connectedObj[connectedObjProp] = value
        else this.execListenersSet()
      }
    })
    var connectedObjPropertyDescriptor = Object.getOwnPropertyDescriptor(connectedObj, connectedObjProp)
    Object.defineProperty(connectedObj, connectedObjProp, {
      get: () => {
        // this.log('defineProperty connectedObj  GET', objValue, //this.logData)
        if (connectedObjPropertyDescriptor && connectedObjPropertyDescriptor.get)connectedObjPropertyDescriptor.get()
        this.execListenersGet()
        return connectedObjValue
      },
      set: (value) => {
        // this.log('defineProperty connectedObj SET', value, //this.logData)
        if (connectedObjPropertyDescriptor && connectedObjPropertyDescriptor.set)connectedObjPropertyDescriptor.set(value)
        connectedObjValue = value
        if (objValue !== value) this.obj[this.prop] = value
        else this.execListenersSet()
      }
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
