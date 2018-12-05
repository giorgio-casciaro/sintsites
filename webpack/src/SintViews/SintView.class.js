import diffDOM from 'diff-dom'
var dd = new diffDOM({

})
export default class SintView {
  constructor (template, params, bindingsData, parentView) {
    // this.log('Constructor', {template, params, parentView})
    this.usedParams = {}
    this.parentView = parentView
    this.template = template
    if (!this.template || !this.template.render) throw new Error('TEMPLATE NOT DEFINED OR ERRONEUS:' + template)
    if (this.template.defaultData) {
      Object.assign(this, this.template.defaultData)
    }
    this.trackedViews = {}
    this.params = Object.assign({}, this.template.defaultParams, params)
    if (!this.params.trackid) this.params.trackid = Math.random()
    this.bindingsData = bindingsData
    this.bindings = {}
    this.bindingsToParent = {}
    this.bindingsToChildren = {}
    this.domUpdateQueue = {}
  }
  log () {
    console.log.apply(
      console,
      ['/ SintView / '].concat(Array.from(arguments)).concat([this])
    )
  }
  param (name, value) {
    if (typeof (value) !== 'undefined') {
      if (this.params[name] !== value) {
        console.log('param1', name, value)
        this.params[name] = value
        if (this.usedParams[name]) this.domUpdate(name)
        this.log('bindingsToParent bindingsToChildren', {bindingsToParent: this.bindingsToParent, bindingsToChildren: this.bindingsToChildren})
        if (this.bindingsToParent[name]) this.bindingsToParent[name].forEach((bindData) => bindData[0].param(bindData[1], value))
        if (this.bindingsToChildren[name]) this.bindingsToChildren[name].forEach((bindData) => bindData[0].param(bindData[1], value))
      }
      return true
    }
    this.usedParams[name] = true
    return this.params[name]
  }
  init () {
    if (this.inited) return false
    this.inited = true
    if (this.template.init) this.template.init.call(this)
    if (this.parentView && this.params.trackid) this.parentView.trackedViews[this.params.trackid] = this
    for (let i in this.params) this.initParam(i)
    for (let i in this.bindingsData) this.initBind(i, this.bindingsData[i])
    this.setTemplateCss()
  }
  initBind (bindName, bindData) {
    var bindView = bindData[0]
    var bindField = bindData[1]
    var bindMode = bindData[2] || 'toFromParent'
    if (bindMode === 'toFromParent' || bindMode === 'toParent') {
      if (!this.bindingsToParent[bindName]) this.bindingsToParent[bindName] = []
      this.bindingsToParent[bindName].push([bindView, bindField])
    }
    if (bindMode === 'toFromParent' || bindMode === 'fromParent') {
      if (!bindView.bindingsToChildren[bindField]) bindView.bindingsToChildren[bindField] = []
      bindView.bindingsToChildren[bindField].push([this, bindName])
    }
    this.params[bindName] = bindView.param(bindField)
  }
  initParam (paramName) {
    let paramValue = this.params[paramName]
    Object.defineProperty(this.params, paramName, {
      get: () => paramValue,
      set: value => {
        paramValue = value
        if (this.usedParams[paramName]) this.domUpdate(paramName)
      }
    })
  }

  async viewRender (template, params, bindings, asDom, onInit) {
    // //this.log('viewRender', template, params, this.trackViews, this)
    if (typeof template === 'string')template = await this.getTemplate(template)
    var subView = new SintView(template, params, bindings, this)
    subView.init()
    if (onInit)onInit(subView)
    return this.viewRenderByView(subView, asDom)
  }
  async viewRenderByView (subView, asDom, forceRendering) {
    if (!subView) return ''
    // this.log('viewRenderByView', {template: this.template.name, templateSubView: subView.template.name, trackViews: this.trackViews, trackid: subView.params.trackid})
    // //this.log('viewRender', subView, this.trackViews, this)
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
    // //this.log('subView', subView)
    if (asDom) return await subView.renderDom()
    var subViewHtml = await subView.render()
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
    // //this.log('reactiveAreaLog', reactiveArea, this.trackedViews)
    return reactiveArea
  }
  async render (placeholders = false) {
    this.init()
    // this.log('TEMPLATE_RENDER', this.template ? this.template.name : '')
    this.trackViews = placeholders
    this.trackedViews = {}
    this.usedParams = {}
    this.reactiveAreaCounter = 0
    var htmlString = await this.template.render.call(this, this.params)
    if (this.params.trackid) {
      let position = htmlString.indexOf('>')
      htmlString = htmlString.slice(0, position) + " trackid='" + this.params.trackid + "'" + htmlString.slice(position)
    }
    let position1 = htmlString.indexOf('>')
    htmlString = htmlString.slice(0, position1) + " sintview='1'" + htmlString.slice(position1)

    return htmlString.trim()
  }
  domUpdate (field) {
    // this.log('domUpdate', field)
    this.domUpdateQueue[field] = this.params[field]
    if (this.domUpdateTimeout) clearTimeout(this.domUpdateTimeout)
    this.domUpdateTimeout = setTimeout(() => {
      this.domUpdateApply()
    }, 1)
  }
  async domUpdateApply () {
    if (this.template.domUpdate) { return this.template.domUpdate.call(this, this.dom, this.domUpdateQueue) } else return this.renderDom(true)
    this.domUpdateQueue = {}
  }
  domReplaceNode (newDom, oldDom) {
    oldDom.parentNode.replaceChild(newDom, oldDom)
  }
  domGetByTag (tag, dom = this.dom) {
    return Array.from(dom.getElementsByTagName(tag))
  }
  // bind (paramName, logData) {
  //   return () => new SintBinding(this.params, paramName, logData)
  // }
  domReplaceNodeContentsAndAttributes (dom1, dom2) {
    // var diffSkipTrackIdTag = !!this.params.trackid
    dd.filterOuterDiff = (t1, t2, diffs) => {
      // //console.log('domReplaceNodeContentsAndAttributes', this.template.name, t1.nodeName, t2.nodeName, diffs, t1, t2)
      if (t1.attributes && t1.attributes.trackid && t1.attributes.trackid !== this.params.trackid && t2.attributes && t1.attributes.trackid === t2.attributes.trackid && t2.nodeName === 'sintview') {
        t1.innerDone = true
        return []
      }
      // if (t2.childNodes)t2.childNodes = t2.childNodes.filter((childNode) => childNode.nodeName !== 'SINTVIEW')
      // if (t1.childNodes)t1.childNodes = t1.childNodes.filter((childNode) => !(childNode.attributes && childNode.attributes.trackid))
    }
    try {
      var diff = dd.diff(dom1, dom2)
      let result = dd.apply(dom1, diff)
    } catch (err) {
      console.error('ERROR domReplaceNodeContentsAndAttributes', err)
    }
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
  async checkTrackedViews () {
    // this.log('checkTrackedViews', {template: this.template.name, trackedViews: Object.keys(this.trackedViews).length, dom: this.dom.innerHTML})

    if (Object.keys(this.trackedViews).length) {
      let domPlaceholdersTags = this.domGetByTag('sintview', this.dom)
      // this.log('checkTrackedViews 1  ', this.template.name, domPlaceholdersTags)
      for (let i = 0; i < domPlaceholdersTags.length; i++) {
        var trackid = domPlaceholdersTags[i].getAttribute('trackid')
        // this.log('checkTrackedViews 2  ', this.template.name, trackid, this.trackedViews[trackid])
        if (this.trackedViews[trackid]) {
          // this.log('renderDom domPlaceholder ', domPlaceholdersTags, i, trackid)
          let subView = this.trackedViews[trackid]
          // this.log('renderDom subView 1', this.template.name, subView.template.name, subView.dom)
          if (!subView.dom) await subView.renderDom()
          // this.log('renderDom subView 2', this.template.name, subView.template.name, subView.dom)
        // this.trackedViews[trackid].dom.parentNode.replaceChild(this.trackedViews[trackid].dom.cloneNode(), this.trackedViews[trackid].dom)
          domPlaceholdersTags[i].parentNode.replaceChild(subView.dom, domPlaceholdersTags[i])
        } else this.log('renderDom domPlaceholder not founded ', domPlaceholdersTags[i], i, trackid)
      }
    }
    // this.log('checkTrackedViews 3', {template: this.template.name, dom: this.dom.innerHTML})
  }
  async renderDom () {
    if (!document) throw new Error('no document')
    // RENDER
    var renderedString = await this.render(true)
    // this.log('renderDom 1', {template: this.template.name, renderedString})
    // ////this.log('renderDom RENDER', tempDomPlaceholders)

    if (!this.dom || !this.domPlaceholdersHtml || this.domPlaceholdersHtml !== renderedString) {
      this.domUpdateId = 0
      // this.log('renderDom 2', {template: this.template.name, check: this.domPlaceholdersHtml !== renderedString, renderedString, domPlaceholdersHtml: this.domPlaceholdersHtml})
      this.domPlaceholdersHtml = renderedString
      // CREATE DOM
      var dom = document.createElement('div')
      dom.innerHTML = renderedString
      var tempDomPlaceholders = dom.childNodes[0]
      // this.log('renderDom 3', {template: this.template.name, domInit: this.template.domInit ? this.template.domInit.toString() : '', check2: !this.dom})

      // if (this.template.domInit && (!this.dom || !this.dom.sintView)) { this.template.domInit.call(this, tempDomPlaceholders) }
      if (!this.domInited && this.template.domInit) {
        this.domInited = true
        this.template.domInit.call(this, tempDomPlaceholders)
      }
      // //this.log('renderDom CREATE DOM', tempDomPlaceholders.innerHTML, this.dom ? this.dom.innerHTML : '')

      // DOM DIFF
      if (this.dom) {
        this.domReplaceNodeContentsAndAttributes(this.dom, tempDomPlaceholders)
        // this.log('renderDom 4', {template: this.template.name, tempDomPlaceholders: tempDomPlaceholders.innerHTML, dom: this.dom.innerHTML})
      } else this.dom = tempDomPlaceholders
      this.dom.sintView = this
      // this.log('renderDom 5', {template: this.template.name, dom: this.dom})
      this.checkTrackedViews()
      // //this.log('renderDom DOM DIFF', tempDomPlaceholders.innerHTML, this.dom.innerHTML)
      // SUBVIEWS PLACEHOLDERS SUBSTITUTION
    }

    return this.dom
  }
}
