import AdvHtmlEditorFeObjBase from './AdvHtmlEditorFeObjBase.class'
import SintView from 'SintViews/SintView.class'
import SintBinding from 'SintViews/SintBinding.class'

export default class AdvHtmlEditorFeObj extends AdvHtmlEditorFeObjBase {
  constructor (feobjid, params, contents, parent, feObjType, styles, actions) {
    super(feobjid, params, parent)
    this.editor = parent.editor
    if (!feObjType || !feObjType.name) throw new Error('FE OBJECT NOT DEFINED OR ERRONEUS ' + JSON.stringify(feObjType))
    this.objType = feObjType
    this.params = Object.assign({}, this.objType.defaultParams, params)
    this.styles = Object.assign({}, this.objType.defaultStyles, styles)
    this.actions = Object.assign({}, this.objType.defaultActions, actions)
    if (this.objType.init) this.objType.init.call(this)

    // this.editor.domUpdate('feObjs')
    this.setContents(contents || '')
    this.body = new SintView(this.objType.body, {trackid: this.feobjid + 'body', feObj: this, editor: this.editor}, {}, parent.body)
    this.ui = new SintView(this.objType.ui, {trackid: this.feobjid + 'ui', feObj: this, editor: this.editor }, {}, this.editor.body)
  }
  param (name, value) {
    if (value) {
      this.params[name] = value
      this.updateData()
    }
    this.params = this.params
    // this.log('param', name, value)
    return this.params[name]
  }
  style (name, value) {
    if (value) {
      this.styles[name] = value
      this.updateData()
    }
    this.styles = this.styles
    // this.log('styles', name, value)
    return this.styles[name]
  }
  action (name, value) {
    if (value) {
      this.actions[name] = value
      this.updateData()
    }
    this.actions = this.actions
    // this.log('actions', name, value)
    return this.params[name]
  }
  contents () {
    return this.contents
  }
  delete () {
    if (this.body.dom) { this.body.dom.remove() }
    if (this.ui.dom) { this.ui.dom.remove() }
    if (this.panel && this.panel.dom) { this.panel.dom.remove() }
    delete this.editor.feObjs[this.params.feobjid]
    this.parent.updateContents()
    this.editor.selectAdvHtmlEditorFeObj(null)
  }
  getClasses (element, state) {
    let classes = []
    for (let i in this.styles[element].states) {
      var state = this.styles[element].states[i]
      for (let prop in state.classes) {
        classes.push(i + '_' + prop + '_' + state.classes[prop])
      }
    }
    //console.log('getClasses', classes)
    return classes
  }
  getStyle () {
    return 'display:block'
  }
}
