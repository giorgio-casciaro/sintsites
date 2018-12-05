function log () {
  console.log.apply(console, ['/ SintView / '].concat(Array.from(arguments)))
}
class SintView {
  constructor (templateName, params, parentView) {
    this.usedBindings = {}
    this.parentView = parentView
    this.template = this.getTemplate(templateName)
    if (!this.template) throw new Error('TEMPLATE NOT DEFINED:' + templateName)
    if (this.template.defaultData) Object.assign(this, this.template.defaultData)
    this.trackedViews = {}
    this.params = Object.assign({}, this.template.defaultParams, params)
    this.bindings = {}
    this.domUpdateQueue = {}
  }
  init () {
    if (this.inited) return false
    this.inited = true
    for (var i in this.params) {
      let paramName = i
      if (typeof this.params[paramName] === 'function') {
        console.log('function param', paramName, this.params[paramName])
        this.params[paramName] = this.params[paramName].call(this)
        // Object.defineProperty(this.params, paramName, { get: () => param.call(this), set: value => { param = value } })
      }
      if (this.params[paramName].addBinding) {
        this.bindings[paramName] = this.params[paramName]
        this.params[paramName].addBinding(this.params, paramName, () => { log('param.addBinding execListener GET', paramName); this.usedBindings[paramName] = true }, () => { log('param.addBinding execListener SET', paramName); if (this.usedBindings[paramName]) this.domUpdate(paramName) }, this)
        console.log('paramaddBindingstart', paramName, this)
      }
    }
  }
  setChildrens (getTemplate) {
    this.getTemplate = getTemplate
  }
  setTemplateGetter (getTemplate) {
    this.getTemplate = getTemplate
  }
  viewRender (templateName, params) {
    this.usedBindings = {}
    if (this.trackViews && params.trackid) {
      this.trackedViewsData[params.trackid] = [templateName, params]
      return '<sintview trackid="' + params.trackid + '"/>'
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
    this.trackViews = placeholders
    this.trackedViewsData = {}
    var htmlString = this.template.render.call(this, this.params)
    console.log('render', this)
    if (this.params.trackid) {
      console.log('htmlString trackid', htmlString, htmlString.indexOf('>'))
      let position = htmlString.indexOf('>')
      htmlString = htmlString.slice(0, position) + " trackid='" + this.params.trackid + "'" + htmlString.slice(position)
    }
    return htmlString
  }
  domUpdate (field) {
    console.log('domUpdate', this.dom)
    // if (!this.dom) return false
    this.domUpdateQueue[field] = this.params[field]
    if (this.domUpdateTimeout) clearTimeout(this.domUpdateTimeout)
    this.domUpdateTimeout = setTimeout(() => { this.domUpdateApply.call(this) }, 10)
  }
  domUpdateApply () {
    console.log('domUpdateApply', this, this.dom)
    if (this.template.domUpdate) {
      this.template.domUpdate.call(this, this.dom, this.domUpdateQueue)
    } else {
      this.renderDom(true)

      // var newNodesToTrack = this.dom.querySelectorAll('[trackid]')
      // for (let i = 0; i < newNodesToTrack.length; i++) {
      //   let trackid = newNodesToTrack[i].getAttribute('trackid')
      //   if (this.trackedDomSubNodes[trackid]) {
      //     console.log('domUpdateApply trackid', trackid, this.trackedDomSubNodes[trackid], newNodesToTrack[i])
      //     this.domReplaceNode(this.trackedDomSubNodes[trackid], newNodesToTrack[i])
      //   }
      // }

      // this.domReplaceNode(oldDom, this.dom)
      //
      // this.dom = oldDom
    }
    this.domUpdateQueue = {}
  }
  domReplaceNode (newDom, oldDom) {
    console.log('domReplaceNode', newDom, oldDom, newDom.attributes, oldDom.attributes)
    oldDom.parentNode.replaceChild(newDom, oldDom)
  }
  bind (paramName, logData) {
    log('before before SintBindingMain  ', paramName, logData)
    var bindPromise = () => { log('before SintBindingMain  ', paramName, logData); return new SintBinding(this.params, paramName, logData) }
    return bindPromise
  }
  domReplaceNodeContentsAndAttributes (from, to) {
    console.log('domReplaceNodeContentsAndAttributes', from, to, from.attributes, to.attributes)
    var fromAttrs = Array.from(from.attributes)
    // var toAttrs = Array.from(to.attributes)
    for (var i in fromAttrs) to.setAttribute(fromAttrs[i].name, fromAttrs[i].value)
    // oldDom.parentNode.replaceChild(newDom, oldDom)
    while (to.firstChild) to.removeChild(to.firstChild)
    while (from.firstChild) to.appendChild(from.firstChild)
  }
  renderDom (setAsMainDom = true) {
    if (!document) throw new Error('no document')
    var dom = document.createElement('div')
    var renderedString = this.render(true)
    dom.innerHTML = renderedString
    var returnDom = dom.childNodes[0]
    if (this.template.domInit) this.template.domInit.call(this, returnDom)

    if (!this.domPlaceholdersHtml || this.domPlaceholdersHtml !== renderedString) {
      this.domPlaceholdersHtml = renderedString
      if (Object.keys(this.trackedViewsData).length) {
        let domPlaceholders = dom.getElementsByTagName('sintview')
        for (let i = 0; i < domPlaceholders.length; i++) {
          var trackid = domPlaceholders[i].getAttribute('trackid')
          if (this.trackedViews[trackid]) {
            console.log('renderDom trackedViews', this.trackedViews[trackid])
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
      }
    }

    return returnDom
  }
}
if (typeof module !== 'undefined') module.export = SintView
