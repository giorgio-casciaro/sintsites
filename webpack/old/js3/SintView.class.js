var dd = new diffDOM({

  // textDiff: function (info) {
  //   console.log('textDiff', info)
  // },
  // filterOuterDiff: function (t1, t2, diffs) {
  //   console.log('filterOuterDiff', { dd, t1, t2, diffs })
  //   // if (t1.attributes && t1.attributes.trackid) {
  //   //   // will not diff childNodes
  //   //   t1.innerDone = true
  //   //   // t2.innerDone = true
  //   // }
  // },
  preVirtualDiffApply: function (info) {
    console.log('preVirtualDiffApply', info)
  },
  postVirtualDiffApply: function (info) {
    console.log('postVirtualDiffApply', info)
  },
  preDiffApply: function (info) {
    console.log('preDiffApply', info)
  },
  postDiffApply: function (info) {
    console.log('postDiffApply', info)
  }
})
class SintView {
  constructor (templateName, params, parentView) {
    this.usedParams = {}
    this.parentView = parentView
    this.template = this.getTemplate(templateName)
    if (!this.template) throw new Error('TEMPLATE NOT DEFINED:' + templateName)
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
    for (var i in this.params) {
      this.initParam(i)
    }
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
          this.log(
            'domUpdate before',
            this.usedParams[paramName],
            this.usedParams,
            paramName
          )
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
          this.log(
            'newForm',
            this.usedParams[paramName],
            this.usedParams,
            paramName
          )
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
    for (var i in paramsToBind) {
      params[paramsToBind[i]] = this.bind(
        paramsToBind[i],
        'reactiveArea ' + paramsToBind[i]
      )
    }
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
  domReplaceNodeContentsAndAttributes (from, to) {
    // var diffSkipTrackIdTag = !!this.params.trackid
    dd.filterOuterDiff = (t1, t2, diffs) => {
      if (t2.childNodes)t2.childNodes = t2.childNodes.filter((childNode) => childNode.nodeName !== 'SINTVIEW')
      if (t1.childNodes)t1.childNodes = t1.childNodes.filter((childNode) => !(childNode.attributes && childNode.attributes.trackid))
      // if (t1.childNodes)t1.childNodes.forEach((childNode) => { if (childNode.attributes && childNode.attributes.trackid) { childNode.innerDone = true; childNode.valueDone = true; childNode.outerDone = true } })
      // if (t2.childNodes)t2.childNodes.forEach((childNode) => { if (childNode.nodeName === 'SINTVIEW') { childNode.innerDone = true; childNode.valueDone = true; childNode.outerDone = true } })
      console.log('renderDom domReplaceNodeContentsAndAttributes filterOuterDiff', JSON.stringify(diffs), t1.outerDone, t1.valueDone, t2.outerDone, t2.valueDone, { t1, t2, diffs }, this)
      // if (t2.nodeName === 'SINTVIEW') { t2.outerDone = t2.valueDone = t2.innerDone = true }
      // if (t1.attributes && t1.attributes.trackid) {
      //   if (!diffSkipTrackIdTag) {
      //     t1.outerDone = t1.valueDone = t1.innerDone = true
      //     // t1.outerDone = true
      //     // return []
      //   } else {
      //     diffSkipTrackIdTag = true
      //   }
      // }
    }
    var diff = dd.diff(to, from)
    this.log('renderDom domReplaceNodeContentsAndAttributes', {
      from: from.innerHTML,
      to: to.innerHTML,
      diff
    })
    let result = dd.apply(to, diff)
    this.log('renderDom domReplaceNodeContentsAndAttributes after', {
      result,
      from: from.innerHTML,
      to: to.innerHTML,
      diff
    })
    // var fromAttrs = Array.from(from.attributes)
    // for (var i in fromAttrs) {
    //   to.setAttribute(fromAttrs[i].name, fromAttrs[i].value)
    // }
    // while (to.firstChild) {
    //   to.removeChild(to.firstChild)
    // }
    // while (from.firstChild) {
    //   to.appendChild(from.firstChild)
    // }
  }
  renderDom () {
    if (!document) throw new Error('no document')
    // RENDER
    var renderedString = this.render(true)
    this.log('renderDom RENDERED STRING', renderedString, this.dom)
    // this.log('renderDom RENDER', tempDomPlaceholders)

    if (!this.domPlaceholdersHtml || this.domPlaceholdersHtml !== renderedString) {
      this.domPlaceholdersHtml = renderedString
      // CREATE DOM
      var dom = document.createElement('div')
      dom.innerHTML = renderedString
      var tempDomPlaceholders = dom.childNodes[0]
      if (this.template.domInit) this.template.domInit.call(this, tempDomPlaceholders)
      this.log('renderDom CREATE DOM', tempDomPlaceholders.innerHTML, this.dom ? this.dom.innerHTML : '')

      // DOM DIFF
      if (this.dom) {
        this.domReplaceNodeContentsAndAttributes(tempDomPlaceholders, this.dom)
      } else this.dom = tempDomPlaceholders
      this.dom.sintView = this
      this.log('renderDom DOM DIFF', tempDomPlaceholders.innerHTML, this.dom.innerHTML)
      // SUBVIEWS PLACEHOLDERS SUBSTITUTION
      if (Object.keys(this.trackedViewsData).length) {
        let domPlaceholdersTags = this.domGetByTag('sintview', this.dom)
        for (let i = 0; i < domPlaceholdersTags.length; i++) {
          var trackid = domPlaceholdersTags[i].getAttribute('trackid')
          this.log('renderDom domPlaceholder ', domPlaceholdersTags, i, trackid)
          var trackedViewData = this.trackedViewsData[trackid]
          let subView = new SintView(trackedViewData[0], trackedViewData[1], this)
          this.trackedViews[trackid] = subView
          subView.renderDom()
            // this.trackedViews[trackid].dom.parentNode.replaceChild(this.trackedViews[trackid].dom.cloneNode(), this.trackedViews[trackid].dom)
          domPlaceholdersTags[i].parentNode.replaceChild(subView.dom, domPlaceholdersTags[i])
        }
      }
    }

    this.log('renderDom 2', tempDomPlaceholders.innerHTML)
    return tempDomPlaceholders
  }
}
if (typeof module !== 'undefined') module.export = SintView
