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
  contents: '<p>page contents</p>',
  allCss: {}
}
var feObjects = {
  title: 'page title',
  contents: '<p>page contents</p>'
}
const domManipulation = {
  applyCommand: function (command, params) {
    console.log('applyCommand this ', this, command, params)
    var contents = this.range.extractContents()
    var p = command(contents, params)
    this.log('applyCommand p', p)
    if (p) {
      this.range.deleteContents()
      this.range.insertNode(p)
    } else {
      this.range.insertNode(contents)
    }
    if (this.afterApplyCommand) this.afterApplyCommand(command, params, p, contents)

  // this.updateHtml()
  },
  htmlContainer: function (contents, params = { string: '<p/>', flat: false }) {
    var dom = document.createElement('div')
    dom.innerHTML = params.string
    var element = dom.childNodes[0]
    element.appendChild(contents)
    window.console.log('htmlContainer', dom, element)
    return element
  },
  insertFeObject: function (feObjectType) {
    var dom = document.createElement('div')
    dom.appendChild(this.range.extractContents())
    this.log('feObj dom.innerHTML', dom.innerHTML)
    this.domPlaceholders = false
    // var feObj = this.viewRender('feObj' + feObjectType, { contents: dom.innerHTML, feobjid }, true)
    // var feObj = new SintView('feObj' + feObjectType, { contents: dom.innerHTML, feobjid }, this)
    var feObj = new FeObj(null, feObjectType, { contents: dom.innerHTML }, this)
    this.editor.feObjs[feObj.feobjid] = feObj
    console.log(feObj)
    this.range.insertNode(feObj.body.renderDom())
    if (this.afterInsertFeObject) this.afterInsertFeObject(feObjectType)
  }
}

class AdvEditor {
  constructor () {
    var _this = this
    this.feObjs = {}
    this.editor = this
    this.contents = 'test'
    this.body = new SintView('advEditorBody', {contents: new SintBinding(this, 'contents')})
    this.body.editor = this
    this.domManipulation = {}
    for (let i in domManipulation) this.domManipulation[i] = function () { return domManipulation[i].apply(_this, arguments) }
    this.selectedFeObject = null
    this.afterApplyCommand = () => this.contents = this.body.advEditorBody.innerHTML
    this.afterInsertFeObject = () => this.contents = this.body.advEditorBody.innerHTML
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
    return this.feObjs[feobjid]
  }
  // openPanel (panelView) {
  //   this.panel = panelView
  // }
  // closePanel () {
  //   this.panel = null
  // }

}

class FeObj {
  constructor (feobjid, feObjectType, params, parent) {
    if (!feobjid) feobjid = Math.floor(Math.random() * 10000000000000000)
    this.feobjid = feobjid
    this.params = params
    this.parent = parent
    this.editor = parent.editor || parent
    this.objType = feObjsDb[feObjectType]
    // this.editor.domUpdate('feObjs')
    this.body = new SintView(this.objType.body, this.params)
    this.body.editor = this.editor
    this.body.feObj = this

    this.ui = new SintView(this.objType.ui, this.params)
    this.ui.editor = this.editor
    this.ui.feObj = this
  }
  openPanel (panel) {
    this.panel = new SintView(this.objType['panel_' + panel], this.params)
  }
  closePanel (panel) {
    this.panel = null
  }
  delete () {
    if (this.dom) { this.dom.parentNode.deleteChild(this.dom) }
    delete this.editor.feObjs[this.params.feobjid]
  }
}

var advEditor = new AdvEditor()
var contentsFunc = function () {
  return `<div>
  <div>menu</div>
  <div>${this.viewRenderByView(advEditor.body)}</div>
  <div>panel</div>
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
