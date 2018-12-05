function log () {
  console.log.apply(console, ['/ SintView / '].concat(Array.from(arguments)))
}
class SintView {
  constructor (templateName, params, parentView) {
    this.trackedDomSubNodes = {}
    this.parentView = parentView
    this.template = this.getTemplate(templateName)
    if (!this.template) throw new Error('TEMPLATE NOT DEFINED:' + templateName)
    if (this.template.defaultData) Object.assign(this, this.template.defaultData)
    this.trackedDomSubNodes = {}
    this.subViews = {}
    this.params = Object.assign({}, this.template.defaultParams, params)
    // if (this.params.trackid) this.params.trackid = templateName + '_' + this.params.trackid
    for (let i in this.params) {
      let param = this.params[i]
      if (this.params[i].addBinding) param.addBinding(this.params, () => { log('param.addBinding execListener', i); this.domUpdate(i) }, this)
      if (this.params[i] instanceof Function) {
        let param = this.params[i]
        Object.defineProperty(this.params, i, { get: () => param.call(this), set: value => { param = value }
        })
      }
    }

    this.domUpdateQueue = {}
  }
  setChildrens (getTemplate) {
    this.getTemplate = getTemplate
  }
  setTemplateGetter (getTemplate) {
    this.getTemplate = getTemplate
  }
  viewRender (templateName, params) {
    if (this.domPlaceholders) {
      this.domPlaceholdersViews.push([templateName, params])
      return '<sintview index="' + (this.domPlaceholdersViews.length - 1) + '"/>'
    }
    // this.trackedDomSubNodes[id] = new SintView(templateName, params, this)
    var subView = new SintView(templateName, params, this)
    var subViewHtml = subView.render()
    // this.subViews.push(subView)
    // if (subView.params.trackid) this.trackedSubViews[subView.params.trackid] = subView.dom
    return subViewHtml
  }
  render (placeholders = false) {
    this.domPlaceholders = placeholders
    this.domPlaceholdersViews = []
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
      var newDom = this.renderDom(false)
      this.domReplaceNodeContentsAndAttributes(newDom, this.dom)

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
    dom.innerHTML = this.render(true)
    var returnDom = dom.childNodes[0]
    if (this.template.domInit) this.template.domInit.call(this, returnDom)
    if (setAsMainDom) this.dom = returnDom
    if (this.domPlaceholdersViews.length) {
      let domPlaceholders = dom.getElementsByTagName('sintview')
      for (let i = 0; i < domPlaceholders.length; i++) {
        var placeholderView = this.domPlaceholdersViews[domPlaceholders[i].getAttribute('index')]
        console.log('domPlaceholdersViews', this.domPlaceholdersViews, i, domPlaceholders[i], domPlaceholders[i].getAttribute('index'), placeholderView)
        let subView = new SintView(placeholderView[0], placeholderView[1], this)
        // this.subViews[i] = subView
        domPlaceholders[i].parentNode.replaceChild(subView.renderDom(), domPlaceholders[i])
      }
    }
    return returnDom
  }
}
if (typeof module !== 'undefined') module.export = SintView
