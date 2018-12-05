import styleFw from 'AdvHtmlEditor/templates/framework.js'
import 'AdvHtmlEditor/templates/styleEditor.css'
var getEmptyState = function () { return {classes: {}, customClasses: [], customCss: ''} }

export default {
  name: 'AdvHtmlEditor/styleEditor',
  render: async function (params) {
    var stateContents = async function (styleElementName, styleStateName, styleStateDef, styleState) {
      //console.log('stateContents', {styleElementName, styleStateName, styleStateDef, styleState})
      let html = ''
      html += "<div class='styleStateEditor'>"
      html += `<div class='styleStateEditorCustomCss'><label>Custom Css</label><textarea>${styleState.customCss}</textarea></div>`

      html += JSON.stringify(styleState)
      for (var i in styleFw.classes) {
        let styleFwProp = styleFw.classes[i]
        if (styleFwProp.init) styleFwProp = styleFwProp.init(styleFwProp, this.params.style, styleState)
        if (styleFwProp) {
          html += "<div class='styleStateProp'>"
          html += `<div class='styleStatePropName'>${styleFwProp.name}</div>`
          html += `<div class='styleStatePropDescription'>${styleFwProp.description}</div>`
          html += "<div class='styleState'>"
          for (var ii in styleFwProp.classes) {
            let styleFwPropClass = styleFwProp.classes[ii]
            html += `<div class='styleStatePropClass ${styleState.classes[i] === ii ? 'selected' : ''}' onclick='this.closest("[trackid]").sintView.setProp("${styleElementName}","${styleStateName}","${i}","${ii}")'>`
            html += `<div class='styleStatePropClassName'>${styleFwPropClass.name}</div>`
            html += `<div class='styleStatePropClassDescription'>${styleFwPropClass.description}</div>`
            html += `<div class='styleStatePropClassBody'><div><div style='${styleFwPropClass.css}'><div class="textShort">T</div><div class="textLong">exampl long text..</div><div class="subBlock"></div><div class="subBlock"></div><div class="subBlock"></div></div></div></div>`
            html += '</div>'
          }
          html += '</div>'
          html += '</div>'
        }
      }
      html += '</div>'
      return html
    }

    var elementContents = async function (styleElementName, elementDef, styleElement) {
      let html = ''
      var tabs = []
      elementDef.styleStates.forEach((styleStateName) => {
        // let styleStateName = elementDef.styleStates[ii]
        let styleStateDef = styleFw.states[styleStateName]
        let styleState = styleElement[styleStateName]
        //console.log('elementDef.styleStates 1', {styleElementName, styleStateName, styleStateDef, styleState})
        tabs.push({
          title: styleStateDef.name,
          description: styleStateDef.description,
          contents: async function () { //console.log('elementDef.styleStates 2', {styleElementName, styleStateName, styleStateDef, styleState}); return await stateContents.call(this, styleElementName, styleStateName, styleStateDef, styleState || getEmptyState()) }
        })
      })
      html += await this.viewRender('ui/tabs', {trackid: styleElementName + 'elementStatesStyles', classes: ['elementStatesStyles'], tabClasses: ['elementStateStyles'], tabs, feObj: this.params.feObj, editor: this.params.editor})
      return html
    }

    var html = ''
    html += "<div class='AdvHtmlEditorStyleEditor elementsStyles'>"
    var tabs = []
    var elementsDefs = this.param('elementsDefs')
    var styles = this.param('styles')

    Object.keys(elementsDefs).forEach((i) => {
      let styleElement = styles[i] || {}
      let elementDef = elementsDefs[i]
      tabs.push({
        title: elementDef.name,
        description: elementDef.description,
        contents: async function () { return await elementContents.call(this, i, elementDef, styleElement) }
      })
    })
    html += await this.viewRender('ui/tabs', {trackid: 'elementsStyles', classes: [], tabClasses: ['elementStyle'], tabs, feObj: this.params.feObj, editor: this.params.editor})
    html += '</div>'
    return html
  },
  init: function () {
    this.getEmptyState = getEmptyState
    this.setProp = (element, state, prop, value) => {
      //console.log('stylesJSON', JSON.stringify(this.params.styles), {element, state, prop, value})
      if (!this.params.styles[element]) this.params.styles[element] = {}
      if (!this.params.styles[element][state]) this.params.styles[element][state] = getEmptyState()
      if (this.params.styles[element][state].classes[prop] === value) delete this.params.styles[element][state].classes[prop]
      else this.params.styles[element][state].classes[prop] = value
      this.param('styles', this.params.styles)
      //console.log('stylesJSON', this.params.trackedViews, JSON.stringify(this.params.styles), this.usedParams, {element, state, prop, value})
    // this.domUpdate()
      // this.params.feObj.body.domUpdate()
    }
  },
  defaultParams: { tabs: [] }
}
