var dd = new diffDOM({

})
class SintView {
  constructor (template, params, parentView) {
    this.log('Constructor', {template, params, parentView})
    this.usedParams = {}
    this.parentView = parentView
    this.template = typeof template === 'string' ? this.getTemplate(template) : template
    if (!this.template) throw new Error('TEMPLATE NOT DEFINED:' + template)
    if (this.template.defaultData) {
      Object.assign(this, this.template.defaultData)
    }
    this.trackedViews = {}
    this.params = Object.assign({}, this.template.defaultParams, params)
    this.bindings = {}
    this.domUpdateQueue = {}
  }
  log () {
    console.log.apply(
      console,
      ['/ SintView / '].concat(Array.from(arguments)).concat([this])
    )
  }
  param (name, value) {
    if (value) {
      this.params[name] = value
      return true
    }
    this.usedParams[name] = true
    return this.params[name]
  }
  init () {
    if (this.inited) return false
    this.inited = true
    this.log('init', {trackid: this.params.trackid, parentView: this.parentView})
    if (this.parentView && this.params.trackid) this.parentView.trackedViews[this.params.trackid] = this
    this.log('init2', {trackedViews: this.parentView ? this.parentView.trackedViews : ''})
    for (var i in this.params) {
      this.initParam(i)
    }
    this.setTemplateCss()
    if (this.template.init) this.template.init.call(this)
  }
  initParam (paramName) {
    if (typeof this.params[paramName] === 'function') {
      this.params[paramName] = this.params[paramName].call(this)
    }
    if (this.params[paramName].addBinding) {
      this.bindings[paramName] = this.params[paramName]
      this.params[paramName].addBinding(
        this.params,
        paramName,
        () => {
          this.usedParams[paramName] = true
        },
        () => {
          if (this.usedParams[paramName]) this.domUpdate(paramName)
        },
        this
      )
    } else {
      let paramValue = this.params[paramName]
      // var objPropertyDescriptor = Object.getOwnPropertyDescriptor(this.obj, this.prop)
      Object.defineProperty(this.params, paramName, {
        get: () => paramValue,
        set: value => {
          paramValue = value
          if (this.usedParams[paramName]) this.domUpdate(paramName)
        }
      })
    }
  }
  setChildrens (getTemplate) {
    this.getTemplate = getTemplate
  }
  setTemplateGetter (getTemplate) {
    this.getTemplate = getTemplate
  }
  viewRender (template, params, asDom) {
    // this.log('viewRender', template, params, this.trackViews, this)
    var subView = new SintView(template, params, this)
    return this.viewRenderByView(subView, asDom)
  }
  viewRenderByView (subView, asDom, forceRendering) {
    if (!subView) return ''
    this.log('viewRenderByView', {template: this.template.name, trackViews: this.trackViews, trackid: subView.params.trackid})
    // this.log('viewRender', subView, this.trackViews, this)
    if (!forceRendering && this.trackViews && subView.params.trackid) {
      this.trackedViews[subView.params.trackid] = subView
      subView.init()
      // this.trackedViewsData[subView.params.trackid] = [template, params]
      if (asDom) {
        let sintviewElement = document.createElement('sintview')
        sintviewElement.setAttribute('trackid', subView.params.trackid)
        return sintviewElement
      }
      return '<sintview trackid="' + subView.params.trackid + '" ></sintview>'
    }
    // this.log('subView', subView)
    if (asDom) return subView.renderDom()
    var subViewHtml = subView.render()
    return subViewHtml
  }
  reactiveArea (paramsToBind, contentsFunc) {
    this.reactiveAreaCounter++
    var params = {
      contents: () => contentsFunc,
      trackid: 'reactiveArea' + this.reactiveAreaCounter
    }
    for (var i in paramsToBind) {
      params[paramsToBind[i]] = this.bind(
        paramsToBind[i],
        'reactiveArea ' + paramsToBind[i]
      )
    }
    var reactiveArea = this.viewRender('reactiveArea', params)
    // this.log('reactiveAreaLog', reactiveArea, this.trackedViews)
    return reactiveArea
  }
  render (placeholders = false) {
    this.init()
    this.log('TEMPLATE_RENDER', this.template ? this.template.name : '')
    this.trackViews = placeholders
    this.trackedViews = {}
    this.usedParams = {}
    this.reactiveAreaCounter = 0
    var htmlString = this.template.render.call(this, this.params)
    if (this.params.trackid) {
      let position = htmlString.indexOf('>')
      htmlString =
        htmlString.slice(0, position) +
        " trackid='" +
        this.params.trackid +
        "'" +
        htmlString.slice(position)
    }
    // let position = htmlString.indexOf('>')
    // htmlString = htmlString.slice(0, position) + " sv " + htmlString.slice(position)

    return htmlString
  }
  domUpdate (field) {
    this.log('domUpdate', field)
    this.domUpdateQueue[field] = this.params[field]
    if (this.domUpdateTimeout) clearTimeout(this.domUpdateTimeout)
    this.domUpdateTimeout = setTimeout(() => {
      this.domUpdateApply()
    }, 1)
  }
  domUpdateApply () {
    if (this.template.domUpdate) { this.template.domUpdate.call(this, this.dom, this.domUpdateQueue) } else this.renderDom(true)
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
  domReplaceNodeContentsAndAttributes (dom1, dom2) {
    // var diffSkipTrackIdTag = !!this.params.trackid
    dd.filterOuterDiff = (t1, t2, diffs) => {
      // console.log('domReplaceNodeContentsAndAttributes', this.template.name, t1.nodeName, t2.nodeName, diffs, t1, t2)
      if (t1.attributes && t1.attributes.trackid && t1.attributes.trackid !== this.params.trackid && t1.attributes.trackid === t2.attributes.trackid) {
        t1.innerDone = true
        return []
      }
      // if (t2.childNodes)t2.childNodes = t2.childNodes.filter((childNode) => childNode.nodeName !== 'SINTVIEW')
      // if (t1.childNodes)t1.childNodes = t1.childNodes.filter((childNode) => !(childNode.attributes && childNode.attributes.trackid))
    }
    var diff = dd.diff(dom1, dom2)

    let result = dd.apply(dom1, diff)
  }
  // domReplaceNodeContentsAndAttributes (from, to) {
  //   // var diffSkipTrackIdTag = !!this.params.trackid
  //   dd.filterOuterDiff = (t1, t2, diffs) => {
  //     // if (t2.childNodes)t2.childNodes = t2.childNodes.filter((childNode) => childNode.nodeName !== 'SINTVIEW')
  //     if (t1.childNodes)t1.childNodes = t1.childNodes.filter((childNode) => !(childNode.attributes && childNode.attributes.trackid))
  //   }
  //   var diff = dd.diff(to, from)
  //
  //   let result = dd.apply(to, diff)
  // }
  checkTrackedViews () {
    this.log('checkTrackedViews', {template: this.template.name, trackedViews: Object.keys(this.trackedViews).length, dom: this.dom.innerHTML})

    if (Object.keys(this.trackedViews).length) {
      let domPlaceholdersTags = this.domGetByTag('sintview', this.dom)
      this.log('domPlaceholdersTags  ', domPlaceholdersTags)
      for (let i = 0; i < domPlaceholdersTags.length; i++) {
        var trackid = domPlaceholdersTags[i].getAttribute('trackid')
        this.log('checkTrackedView  ', trackid)
        if (this.trackedViews[trackid]) {
          this.log('renderDom domPlaceholder ', domPlaceholdersTags, i, trackid)
          let subView = this.trackedViews[trackid]
          this.log('renderDom subView', subView)
          if (!subView.dom)subView.renderDom()
          // this.trackedViews[trackid].dom.parentNode.replaceChild(this.trackedViews[trackid].dom.cloneNode(), this.trackedViews[trackid].dom)
          domPlaceholdersTags[i].parentNode.replaceChild(subView.dom, domPlaceholdersTags[i])
        } else this.log('renderDom domPlaceholder not founded ', domPlaceholdersTags[i], i, trackid)
      }
    }
    this.log('checkTrackedViews AFTER', {template: this.template.name, dom: this.dom.innerHTML})
  }
  renderDom () {
    if (!document) throw new Error('no document')
    // RENDER
    var renderedString = this.render(true)
    this.log('renderDom RENDERED STRING', {template: this.template.name, renderedString})
    // //this.log('renderDom RENDER', tempDomPlaceholders)

    if (!this.domPlaceholdersHtml || this.domPlaceholdersHtml !== renderedString) {
      this.domUpdateId = 0
      this.log('renderDom UPDATE DOM', {template: this.template.name, check: this.domPlaceholdersHtml !== renderedString, renderedString, domPlaceholdersHtml: this.domPlaceholdersHtml})
      this.domPlaceholdersHtml = renderedString
      // CREATE DOM
      var dom = document.createElement('div')
      dom.innerHTML = renderedString
      var tempDomPlaceholders = dom.childNodes[0]
      if (this.template.domInit && (!this.dom || !this.dom.sintView)) { this.template.domInit.call(this, tempDomPlaceholders) }
      // this.log('renderDom CREATE DOM', tempDomPlaceholders.innerHTML, this.dom ? this.dom.innerHTML : '')

      // DOM DIFF
      if (this.dom) {
        this.domReplaceNodeContentsAndAttributes(this.dom, tempDomPlaceholders)
        this.log('renderDom CREATE DOM2', {template: this.template.name, tempDomPlaceholders: tempDomPlaceholders.innerHTML, dom: this.dom.innerHTML})
      } else this.dom = tempDomPlaceholders
      this.dom.sintView = this
      // console.log("dom.querySelectorAll('*:not(sintview)')", this.dom.querySelectorAll('*:not(sintview)'))
      // this.dom.querySelectorAll('*:not(sintview)').forEach(element => element.sintView = this)
      this.checkTrackedViews()
      // this.log('renderDom DOM DIFF', tempDomPlaceholders.innerHTML, this.dom.innerHTML)
      // SUBVIEWS PLACEHOLDERS SUBSTITUTION
    }

    return this.dom
  }
}
if (typeof module !== 'undefined') module.export = SintView
