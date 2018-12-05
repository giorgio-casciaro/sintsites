function log () {
  console.log.apply(console, ['/ MAIN / '].concat(Array.from(arguments)))
}

var getTemplate = template => {
  if (templatesDb[template]) return new SintTemplate(templatesDb[template])
  else throw new Error('TEMPLATE NOT DEFINED: ' + template)
}

var setTemplateCss = function () {
  if (this.template.css && !page.allCss[this.template.name]) {
    page.allCss[this.template.name] = this.template.css
    page.allCss = page.allCss
  }
  log('setTemplateCss page.allCss', JSON.stringify(page.allCss))
}
SintView.prototype.getTemplate = getTemplate
SintView.prototype.setTemplateCss = setTemplateCss

var page = {
  title: 'page title',
  feObjs: {
    AdvEditor: {
      feobjid: 'advEditor',
      contents: '<p>page contents${this.feObjRender(\'testContainer\')}</p>'
    },
    testContainer: {
      feObjectType: 'Container',
      feobjid: 'testContainer',
      contents: '<p>page contents${this.feObjRender(\'testImg\')}</p>',
      params: {}
    },
    testImg: {
      feObjectType: 'Image',
      feobjid: 'testImg',
      params: {
        src: 'test.png',
        title: 'test.png',
        src: 'test.png'
      }
    }
  },
  allCss: {}
}
var feObjects = {
  title: 'page title',
  contents: '<p>page contents</p>'
}

class FeObjBase {
  constructor (feobjid, params, parent) {
    if (!feobjid) feobjid = Math.floor(Math.random() * 10000000000000000)
    this.feobjid = feobjid
    this.params = params
    this.parent = parent
  }
  setContents (contents) {
    this.contents = contents
    this.contentsFunc = () => {
      return eval('`' + this.contents + '`')
    }
  }
  updateData () {
    var data = {}
    data.feobjid = this.feobjid
    if (this.objTypeName)data.feObjectType = this.objTypeName
    if (this.contents)data.contents = this.contents
    if (this.params)data.params = this.params
    this.editor.feObjsData[this.feobjid] = data
    this.editor.feObjsData = this.editor.feObjsData
  }

  log () { console.log.apply(console, ['/ FeObj / '].concat(Array.from(arguments)).concat([this])) }
  openPanel (panel) {
    this.panel = new SintView(this.objType['panel_' + panel], {trackid: this.feobjid + 'panel_' + panel, feObjParams: this.params}, this.editor.body)
    this.panel.editor = this.editor
    this.panel.feObj = this
    this.panel.renderDom()
    this.editor.body.renderDom()
    // this.log('openPanel', this.editor, this.panel.renderDom().outerHTML)
  }
  closePanel (panel) {
    this.panel = null
  }
  feObjRender (feobjid) {
    var feObj = this.editor.feObj(feobjid)
    return this.body.viewRenderByView(feObj.body)
  }
  contentsMod (element, oldContents) {
    if (element) {
      this.range.deleteContents()
      this.range.insertNode(element)
    } else {
      this.range.insertNode(oldContents)
    }
    if (this.afterDomMod) this.afterDomMod(element, oldContents)
  }
  contentsModHtmlContainer (params = { string: '<p/>', flat: false }) {
    var contents = this.range.extractContents()

    var dom = document.createElement('div')
    dom.innerHTML = params.string
    var element = dom.childNodes[0]
    this.log('contentsModHtmlContainer', element, dom.innerHTML)
    element.appendChild(contents)
    this.contentsMod(element, contents)
  }
  contentsModInsertFeObject (feObjectType, params = {}) {
    var dom = document.createElement('div')
    dom.appendChild(this.range.extractContents())
    this.log('contentsModInsertFeObject1', dom.innerHTML)
    // this.domPlaceholders = false
    dom.querySelectorAll('[feobjid]').forEach((element) => {
      element.parentNode.replaceChild(document.createTextNode("${this.feObjRender('" + element.getAttribute('feobjid') + "')}"), element)
    })
    this.log('contentsModInsertFeObject2', dom.innerHTML)
    var feObj = new FeObj(null, params, dom.innerHTML, this, feObjectType)
    this.editor.feObjs[feObj.feobjid] = feObj
    var childViewRender = this.body.viewRenderByView(feObj.body, true, true)
    this.log('insertFeObject', {childViewRender: childViewRender.outerHTML, feObj})
    this.range.insertNode(childViewRender)
    // this.body.renderDom()
    this.updateContents()
  }
}
class FeObj extends FeObjBase {
  constructor (feobjid, params, contents, parent, feObjectType) {
    super(feobjid, params, parent)
    this.editor = parent.editor
    this.objType = feObjsDb[feObjectType]
    if (!this.objType)console.error('FeObj this.objType required', {feobjid, params, contents, parent, feObjectType})
    this.objTypeName = feObjectType
    this.params = Object.assign({}, this.objType.defaultParams, params)

    // this.editor.domUpdate('feObjs')
    this.setContents(contents || '')
    this.body = new SintView(this.objType.body, {trackid: this.feobjid + 'body', feObjParams: new SintBinding(this, 'params'), feObjContents: new SintBinding(this, 'contentsFunc')}, parent.body)
    this.body.editor = this.editor
    this.body.feObj = this

    this.ui = new SintView(this.objType.ui, {trackid: this.feobjid + 'ui' }, this.editor.body)
    this.ui.editor = this.editor
    this.ui.feObj = this
  }
  param (name, value) {
    if (value) {
      this.params[name] = value
      this.updateData()
    }
    this.params = this.params
    this.log('param', name, value)
    return this.params[name]
  }
  delete () {
    if (this.body.dom) { this.body.dom.remove() }
    if (this.ui.dom) { this.ui.dom.remove() }
    if (this.panel && this.panel.dom) { this.panel.dom.remove() }
    delete this.editor.feObjs[this.params.feobjid]
    this.parent.updateContents()
    this.editor.selectFeObject(null)
  }
}
class AdvEditor extends FeObjBase {
  constructor (feObjsData) {
    super('AdvEditor', {}, null)
    this.log('AdvEditor constructor')
    this.editor = this
    this.feObjsData = feObjsData || {}
    this.feObjs = {}
    this.setContents(feObjsData.AdvEditor.contents)
    this.body = new SintView('advEditorBody', {trackid: 'AdvEditor', contents: new SintBinding(this, 'contentsFunc'), feObjsData: new SintBinding(this, 'feObjsData')})
    this.body.editor = this
    this.domManipulation = {}
    this.selectedFeObject = null

    // this.afterDomMod = () => this.contents = this.body.advEditorBody.innerHTML
    // this.afterInsertFeObject = () => this.contents = this.body.advEditorBody.innerHTML
  }

  log () { console.log.apply(console, ['/ AdvEditor / '].concat(Array.from(arguments)).concat([this])) }
  selectFeObject (feObject) {
    if (this.selectedObject && this.selectedObject.deselect) this.selectedObject.deselect()
    this.selectedFeObject = feObject
    this.body.renderDom()
  }
  deselectFeObject () {
    this.selectedObject.deselect()
    this.selectedFeObject = null
    this.body.renderDom()
  }
  feObj (feobjid, feObj) {
    if (feObj) this.feObjs[feobjid] = feObj
    else if (!this.feObjs[feobjid]) {
      var feObjsData = this.feObjsData[feobjid]
      if (feObjsData) this.feObjs[feobjid] = new FeObj(feobjid, feObjsData.params, feObjsData.contents, this, feObjsData.feObjectType)
    }
    return this.feObjs[feobjid]
  }
  updateContents () {
    var tempAdvEditorBody = this.body.advEditorBody.cloneNode(true)
    tempAdvEditorBody.querySelectorAll('[feobjid]').forEach((element) => {
      element.parentNode.replaceChild(document.createTextNode("${this.feObjRender('" + element.getAttribute('feobjid') + "')}"), element)
    })
    this.log('updateContents', this.body.advEditorBody.innerHTML, tempAdvEditorBody.innerHTML)
    this.setContents(tempAdvEditorBody.innerHTML)
    this.updateData()
  }
  // openPanel (panelView) {
  //   this.panel = panelView
  // }
  // closePanel () {
  //   this.panel = null
  // }

}

var advEditor = new AdvEditor(page.feObjs)
var contentsFunc = function () {
  return `<div>
  <div>menu</div>
  <div>${this.viewRenderByView(advEditor.body)}</div>
  <style>${Object.values(this.param('allCss')).join('\n')}</style>
</div>`
}
log('page.allCss3', JSON.stringify(page.allCss))
// SIMULATE SERVER RENDERING
// document.body.innerHTML = new SintView('contents', {
//   trackid: 'MainSite',
//   contents: () => contentsFunc
// }).render()

// SIMULATE SERVER RENDERING
var appDom = new SintView('contents', {
  trackid: 'MainSite',
  contents: () => contentsFunc, allCss: new SintBinding(page, 'allCss')
}).renderDom()
document.body.replaceChild(appDom, document.body.childNodes[0])
