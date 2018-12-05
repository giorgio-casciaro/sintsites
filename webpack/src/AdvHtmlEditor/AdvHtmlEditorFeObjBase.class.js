import SintView from 'SintViews/SintView.class'
export default class AdvHtmlEditorFeObjBase {
  constructor (feobjid, params, parent) {
    if (!feobjid) feobjid = Math.floor(Math.random() * 10000000000000000)
    this.feobjid = feobjid
    this.params = params
    this.parent = parent
  }
  setContents (contents) {
    this.contentsString = contents
    let contentsFunc = eval('(async function (){return `' + contents + '`})')
    this.contents = async () => { return await contentsFunc.call(this) }
  }
  updateData () {
    var data = {}
    data.feobjid = this.feobjid
    if (this.objTypeName)data.feObjType = this.objTypeName
    if (this.contents)data.contents = this.contents
    if (this.params)data.params = this.params
    if (this.styles)data.styles = this.styles
    if (this.actions)data.actions = this.actions
    this.editor.feObjsData[this.feobjid] = data
    this.editor.feObjsData = this.editor.feObjsData
  }

  log () { console.log.apply(console, ['/ AdvHtmlEditorFeObj / '].concat(Array.from(arguments)).concat([this])) }
  async openPanel (panel) {
    this.panel = new SintView(this.objType['panel_' + panel], {trackid: 'panel_' + panel, feObj: this, editor: this.editor}, {}, this.editor.body)
    await this.panel.renderDom()
    await this.editor.body.renderDom()
    // this.log('openPanel', this.editor, this.panel.renderDom().outerHTML)
  }
  closePanel (panel) {
    this.panel = null
  }
  async feObjRender (feobjid) {
    var feObj = await this.editor.feObj(feobjid)
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
    // this.log('contentsModHtmlContainer', element, dom.innerHTML)
    element.appendChild(contents)
    this.contentsMod(element, contents)
  }
  contentsModInsertAdvHtmlEditorFeObj (feObjType, params = {}) {
    var dom = document.createElement('div')
    dom.appendChild(this.range.extractContents())
    // this.log('contentsModInsertAdvHtmlEditorFeObj1', dom.innerHTML)
    // this.domPlaceholders = false
    dom.querySelectorAll('[feobjid]').forEach((element) => {
      element.parentNode.replaceChild(document.createTextNode("${await this.feObjRender('" + element.getAttribute('feobjid') + "')}"), element)
    })
    // this.log('contentsModInsertAdvHtmlEditorFeObj2', dom.innerHTML)
    var feObj = new AdvHtmlEditorFeObj(null, params, dom.innerHTML, this, feObjType)
    this.editor.feObjs[feObj.feobjid] = feObj
    var childViewRender = this.body.viewRenderByView(feObj.body, true, true)
    // this.log('insertAdvHtmlEditorFeObj', {childViewRender: childViewRender.outerHTML, feObj})
    this.range.insertNode(childViewRender)
    // this.body.renderDom()
    this.updateContents()
  }
}
