function log () {
  console.log.apply(console, ['/ SintView / '].concat(Array.from(arguments)))
}
class SintView {
  constructor (templateName, params, contents, parentView) {
    this.id = Math.floor(Math.random() * 10000000000000000)
    this.parentView = parentView
    this.subViews = []
    this.template = this.getTemplate(templateName)
    if (!this.template) throw new Error('TEMPLATE NOT DEFINED:' + templateName)
    if (this.template.defaultData) {
      Object.assign(this, this.template.defaultData)
    }
    this.subViews = {}
    this.params = Object.assign({}, this.template.defaultParams, params)
    for (let i in this.params) {
      if (this.params[i] instanceof SintBinding) {
        log('SintView ', templateName, i, this.params[i])
        this.params[i].addListener(() => this.domUpdate(i))
        let paramBinding = this.params[i]
        Object.defineProperty(this.params, i, {
          get: () => paramBinding.valueOf(),
          set: value => {
            log('defineProperty ', i, paramBinding.set.toString(), value)
            paramBinding.set(value)
          }
        })
      }
    }
    this.contents = () => {
      if (contents) return contents.call(this)
      return ''
    }
    this.domUpdateQueue = {}
  }
  setChildrens (getTemplate) {
    this.getTemplate = getTemplate
  }
  setTemplateGetter (getTemplate) {
    this.getTemplate = getTemplate
  }
  viewRender (templateName, params, contents) {
    var subViewIndex = this.subViewsCounter
    this.subViews[subViewIndex] = new SintView(templateName, params, contents, this)
    this.subViewsCounter++
    if (this.domPlaceholders) return '<SintView index="' + subViewIndex + '"/>'
    return this.subViews[subViewIndex].render()
  }
  render (placeholders = false) {
    this.domPlaceholders = placeholders
    this.subViewsCounter = 0
    console.log('render', this)
    return this.template.render.call(
      this,
      this.params,
      this.domPlaceholders ? () => '<SintViewContents/>' : this.contents
    )
  }
  domUpdate (field) {
    if (!this.dom) return false
    console.log('domUpdate', this.domUpdateQueue)
    this.domUpdateQueue[field] = this.params[field]
    if (this.domUpdateTimeout) clearTimeout(this.domUpdateTimeout)
    this.domUpdateTimeout = setTimeout(() => {
      console.log('domUpdate', this)
      if (this.template.domUpdate) {
        this.template.domUpdate.call(this, this.dom, this.domUpdateQueue)
      } else {
        var oldDom = this.dom
        var oldDomContents = this.domContents
        this.renderDom(true)
        if (oldDomContents) {
          var domContents = this.dom.querySelector('SintViewContents')
          domContents.parentNode.replaceChild(oldDomContents, domContents)
        }
        oldDom.parentNode.replaceChild(this.dom, oldDom)
      }
      this.domUpdateQueue = {}
    }, 10)
  }
  renderDom (placeholders = false) {
    if (!document) throw new Error('no document')
    var dom = document.createElement('div')
    dom.innerHTML = this.render(placeholders)
    this.dom = dom.childNodes[0]
    if (this.template.domInit) this.template.domInit.call(this, this.dom)
    return this.dom
  }
}
if (typeof module !== 'undefined') module.export = SintView
