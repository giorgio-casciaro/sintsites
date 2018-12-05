import AdvHtmlEditorFeObjBase from './AdvHtmlEditorFeObjBase.class'
import AdvHtmlEditorFeObj from './AdvHtmlEditorFeObj.class'
import SintView from 'SintViews/SintView.class'
import AdvHtmlEditorTemplates from './AdvHtmlEditorTemplates'

export default class AdvHtmlEditor extends AdvHtmlEditorFeObjBase {
  constructor (feObjsData,publicClasses,privateClasses) {
    super('AdvHtmlEditor', {}, null)
    // this.log('AdvHtmlEditor constructor')
    this.editor = this
    this.feObjsData = feObjsData || {}
    this.feObjs = {}
    this.setContents(feObjsData.AdvHtmlEditor.contents)
    this.body = new SintView(AdvHtmlEditorTemplates.advEditorBody, {trackid: 'AdvHtmlEditor',contents: this.contents, feObjsData: this.feObjsData})
    this.body.editor = this
    this.domManipulation = {}
    this.selectedFeObj = null
    this.publicClasses = publicClasses
    this.privateClasses = privateClasses
    // this.afterDomMod = () => this.contents = this.body.advEditorBody.innerHTML
    // this.afterInsertAdvHtmlEditorFeObj = () => this.contents = this.body.advEditorBody.innerHTML
  }

  log () { console.log.apply(console, ['/ AdvHtmlEditor / '].concat(Array.from(arguments)).concat([this])) }
  async selectFeObj (feObj) {
    if (this.selectedFeObj && this.selectedFeObj.deselect) this.selectedFeObj.deselect()
    this.selectedFeObj = feObj
    await this.body.renderDom()
  }
  async deselectFeObj () {
    this.selectedFeObj.deselect()
    this.selectedFeObj = null
    await this.body.renderDom()
  }
  async feObj (feobjid, feObj) {
    if (feObj) this.feObjs[feobjid] = feObj
    else if (!this.feObjs[feobjid]) {
      var feObjsData = this.feObjsData[feobjid]
      var feObjType=await this.getFeObjType(feObjsData.feObjType)
      if (feObjsData) this.feObjs[feobjid] = new AdvHtmlEditorFeObj(feobjid, feObjsData.params, feObjsData.contents, this,feObjType )
    }
    return this.feObjs[feobjid]
  }
  async getFeObjType  (type) {
    var feObj=await import("./FeObjs/"+type)
    return feObj.default
  }
  updateContents () {
    var tempAdvHtmlEditorBody = this.body.advEditorBody.cloneNode(true)
    tempAdvHtmlEditorBody.querySelectorAll('[feobjid]').forEach((element) => {
      element.parentNode.replaceChild(document.createTextNode("${await this.feObjRender('" + element.getAttribute('feobjid') + "')}"), element)
    })
    // this.log('updateContents', this.body.advEditorBody.innerHTML, tempAdvHtmlEditorBody.innerHTML)
    this.setContents(tempAdvHtmlEditorBody.innerHTML)
    this.updateData()
  }
  // openPanel (panelView) {
  //   this.panel = panelView
  // }
  // closePanel () {
  //   this.panel = null
  // }

}
