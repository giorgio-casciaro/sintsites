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
    // this.trackedDomSubNodes[id] = new SintView(templateName, params, this)
    var subView = new SintView(templateName, params, this)
    var subViewHtml = subView.render()
    // this.subViews.push(subView)
    // if (subView.params.trackid) this.trackedSubViews[subView.params.trackid] = subView.dom
    return subViewHtml
  }
  render (placeholders = false) {
    this.init()
    this.log('template render', JSON.stringify(this.params))
    this.trackViews = placeholders
    this.trackedViewsData = {}
    this.usedParams = {}
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
    this.domUpdateTimeout = setTimeout(() => { this.domUpdateApply() }, 10)
  }
  domUpdateApply () {
    if (this.template.domUpdate) this.template.domUpdate.call(this, this.dom, this.domUpdateQueue)
    else this.renderDom(true)
    this.domUpdateQueue = {}
  }
  domReplaceNode (newDom, oldDom) {
    oldDom.parentNode.replaceChild(newDom, oldDom)
  }
  bind (paramName, logData) {
    return () => new SintBinding(this.params, paramName, logData)
  }
  domReplaceNodeContentsAndAttributes (from, to) {
    this.log('domReplaceNodeContentsAndAttributes', from.innerHTML, to.innerHTML)
    var fromAttrs = Array.from(from.attributes)
    for (var i in fromAttrs) to.setAttribute(fromAttrs[i].name, fromAttrs[i].value)
    while (to.firstChild) { to.removeChild(to.firstChild) }
    while (from.firstChild) { to.appendChild(from.firstChild) }
  }
  renderDom (setAsMainDom = true) {
    if (!document) throw new Error('no document')
    var dom = document.createElement('div')
    var renderedString = this.render(true)
    this.log('renderedString', renderedString)
    dom.innerHTML = renderedString
    var returnDom = dom.childNodes[0]
    this.log('renderedString', renderedString)
    if (this.template.domInit) this.template.domInit.call(this, returnDom)
    this.log('renderDom1', returnDom.innerHTML)
    if (!this.domPlaceholdersHtml || this.domPlaceholdersHtml !== renderedString) {
      this.domPlaceholdersHtml = renderedString
      if (Object.keys(this.trackedViewsData).length) {
        let domPlaceholders = dom.getElementsByTagName('sintview')
        for (let i = 0; i < domPlaceholders.length; i++) {
          var trackid = domPlaceholders[i].getAttribute('trackid')
          if (this.trackedViews[trackid]) {
            domPlaceholders[i].parentNode.replaceChild(this.trackedViews[trackid].dom, domPlaceholders[i])
          } else {
            var trackedViewData = this.trackedViewsData[trackid]
            let subView = new SintView(trackedViewData[0], trackedViewData[1], this)
            this.trackedViews[trackid] = subView
            domPlaceholders[i].parentNode.replaceChild(subView.renderDom(), domPlaceholders[i])
          }
        }
      }
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
