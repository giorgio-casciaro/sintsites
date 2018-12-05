var dd = new diffDOM()
class SintView {
  constructor (templateName, params, parentView) {
    this.usedParams = {}
    this.parentView = parentView
    this.template = this.getTemplate(templateName)
    if (!this.template) throw new Error('TEMPLATE NOT DEFINED:' + templateName)
    if (this.template.defaultData) Object.assign(this, this.template.defaultData)
    this.trackedViews = {}
    this.params = Object.assign({}, this.template.defaultParams, params)
    this.bindings = {}
    this.domUpdateQueue = {}
  }
  log () {
    console.log.apply(console, ['/ SintView / '].concat(Array.from(arguments)).concat([this]))
  }
  param (name) {
    this.usedParams[name] = true
    return this.params[name]
  }
  init () {
    if (this.inited) return false
    this.inited = true
    for (var i in this.params) {
      let paramName = i
      if (typeof this.params[paramName] === 'function') this.params[paramName] = this.params[paramName].call(this)
      if (this.params[paramName].addBinding) {
        this.bindings[paramName] = this.params[paramName]
        this.params[paramName].addBinding(this.params, paramName, () => { this.usedParams[paramName] = true }, () => { this.log('domUpdate before', this.usedParams[paramName], this.usedParams, paramName); if (this.usedParams[paramName]) this.domUpdate(paramName) }, this)
      } else {
        let paramValue = this.params[paramName]
        // var objPropertyDescriptor = Object.getOwnPropertyDescriptor(this.obj, this.prop)
        Object.defineProperty(this.params, paramName, {
          get: () => paramValue,
          set: (value) => {
            this.log('newForm', this.usedParams[paramName], this.usedParams, paramName)
            paramValue = value
            if (this.usedParams[paramName]) this.domUpdate(paramName)
          }
        })
      }
    }
    if (this.template.init) this.template.init.call(this)
  }
  setChildrens (getTemplate) {
    this.getTemplate = getTemplate
  }
  setTemplateGetter (getTemplate) {
    this.getTemplate = getTemplate
  }
  viewRender (templateName, params) {
    if (this.trackViews && params.trackid) {
      this.trackedViewsData[params.trackid] = [templateName, params]
      return '<sintview trackid="' + params.trackid + '" ></sintview>'
    }
    var subView = new SintView(templateName, params, this)
    var subViewHtml = subView.render()
    return subViewHtml
  }
  reactiveArea (paramsToBind, contentsFunc) {
    this.reactiveAreaCounter++
    var params = {
      contents: () => contentsFunc,
      trackid: 'reactiveArea' + this.reactiveAreaCounter
    }
    for (var i in paramsToBind)params[paramsToBind[i]] = this.bind(paramsToBind[i], 'reactiveArea ' + paramsToBind[i])
    var reactiveArea = this.viewRender('reactiveArea', params)
    this.log('reactiveAreaLog', reactiveArea, this.trackedViewsData)
    return reactiveArea
  }
  render (placeholders = false) {
    this.init()
    this.log('template render', this.params)
    this.trackViews = placeholders
    this.trackedViewsData = {}
    this.usedParams = {}
    this.reactiveAreaCounter = 0
    var htmlString = this.template.render.call(this, this.params)
    if (this.params.trackid) {
      let position = htmlString.indexOf('>')
      htmlString = htmlString.slice(0, position) + " trackid='" + this.params.trackid + "'" + htmlString.slice(position)
    }
    return htmlString
  }
  domUpdate (field) {
    this.log('domUpdate', field)
    this.domUpdateQueue[field] = this.params[field]
    if (this.domUpdateTimeout) clearTimeout(this.domUpdateTimeout)
    this.domUpdateTimeout = setTimeout(() => { this.domUpdateApply() }, 1)
  }
  domUpdateApply () {
    if (this.template.domUpdate) this.template.domUpdate.call(this, this.dom, this.domUpdateQueue)
    else this.renderDom(true)
    this.domUpdateQueue = {}
  }
  domReplaceNode (newDom, oldDom) {
    oldDom.parentNode.replaceChild(newDom, oldDom)
  }
  domGetByTag (tag, dom = this.dom) {
    return Array.from(dom.getElementsByTagName(tag))
  }
  bind (paramName, logData) {
    return () => new SintBinding(this.params, paramName, logData)
  }
  domReplaceNodeContentsAndAttributes (from, to) {
    var diff = dd.diff(to, from)
    this.log('domReplaceNodeContentsAndAttributes', { from: from.innerHTML, to: to.innerHTML, diff })
    // dd.apply(to, diff)
    var fromAttrs = Array.from(from.attributes)
    for (var i in fromAttrs) to.setAttribute(fromAttrs[i].name, fromAttrs[i].value)
    while (to.firstChild) { to.removeChild(to.firstChild) }
    while (from.firstChild) { to.appendChild(from.firstChild) }
  }
  renderDom (setAsMainDom = true) {
    if (!document) throw new Error('no document')
    // RENDER
    var renderedString = this.render(true)
    this.log('renderedString', renderedString)
    this.log('renderDom RENDER', returnDom)

    if (!this.domPlaceholdersHtml || this.domPlaceholdersHtml !== renderedString) {
      this.domPlaceholdersHtml = renderedString
      // CREATE DOM
      var dom = document.createElement('div')
      dom.innerHTML = renderedString
      var returnDom = dom.childNodes[0]
      if (this.template.domInit) this.template.domInit.call(this, returnDom)
      this.log('renderDom CREATE DOM', returnDom)
      // SUBVIEWS PLACEHOLDERS SUBSTITUTION
      if (Object.keys(this.trackedViewsData).length) {
        let domPlaceholdersTags = this.domGetByTag('sintview', returnDom)
        for (let i = 0; i < domPlaceholdersTags.length; i++) {
          var trackid = domPlaceholdersTags[i].getAttribute('trackid')
          this.log('renderDom domPlaceholder ', domPlaceholdersTags, i, trackid)
          if (this.trackedViews[trackid]) {
            domPlaceholdersTags[i].parentNode.replaceChild(this.trackedViews[trackid].dom, domPlaceholdersTags[i])
          } else {
            var trackedViewData = this.trackedViewsData[trackid]
            let subView = new SintView(trackedViewData[0], trackedViewData[1], this)
            this.trackedViews[trackid] = subView
            domPlaceholdersTags[i].parentNode.replaceChild(subView.renderDom(), domPlaceholdersTags[i])
          }
        }
      }
      // SET MAIN DOM
      if (setAsMainDom) {
        if (this.dom) this.domReplaceNodeContentsAndAttributes(returnDom, this.dom)
        else this.dom = returnDom
        this.dom.sintView = this
        console.log('  this.dom.sintView', this.dom.sintView, this.dom)
      }
    }

    this.log('renderDom 2', returnDom.innerHTML)
    return returnDom
  }
}
if (typeof module !== 'undefined') module.export = SintView
