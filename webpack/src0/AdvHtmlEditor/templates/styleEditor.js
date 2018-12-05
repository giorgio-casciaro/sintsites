import styleFw from 'AdvHtmlEditor/templates/framework.js'
import 'AdvHtmlEditor/templates/styleEditor.css'
var getEmptyState = function () { return {classes: {}, customClasses: [], customCss: ''} }

export default {
  name: 'AdvHtmlEditor/styleEditor',
  render: async function (params) {
    var mainView = this
    var stateContents = async function (styleElementName, styleStateName, styleStateDef) {
      let styleState = this.param('styles')[styleElementName] && this.param('styles')[styleElementName][styleStateName] ? this.param('styles')[styleElementName][styleStateName] : getEmptyState()
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
            html += `<div class='styleStatePropClass ${styleState.classes[i] === ii ? 'selected' : ''}' onclick='this.closest(".AdvHtmlEditorStyleEditor").sintView.setProp("${styleElementName}","${styleStateName}","${i}","${ii}")'>`
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

    var elementContents = async function (styleElementName, elementDef) {
      var elementTab = this
      let html = ''
      var tabs = []
      var styleElement = this.param('styles')[styleElementName] || {}
      elementDef.styleStates.forEach((styleStateName) => {
        // let styleStateName = elementDef.styleStates[ii]
        let styleStateDef = styleFw.states[styleStateName]
        let styleState = styleElement[styleStateName]
        // //console.log('elementDef.styleStates 1', {styleElementName, styleStateName, styleStateDef, styleState})
        tabs.push({
          title: styleStateDef.name,
          description: styleStateDef.description,
          contents: async function () { return await stateContents.call(this, styleElementName, styleStateName, styleStateDef) }
        })
      })
      html += await this.viewRender('ui/tabs', { trackid: 'elementStatesStyles_' + styleElementName, classes: ['elementStatesStyles'], tabClasses: ['elementStateStyles'], tabs, feObj: this.params.feObj, editor: this.params.editor}, {styles: [elementTab.params, 'styles']})
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
        contents: async function () { return await elementContents.call(this, i, elementDef) }
      })
    })

    // mainView.params.activeTab1 = 1
    html += await this.viewRender('ui/tabs', {trackid: 'elementStyle', classes: [], tabClasses: ['elementStyle'], tabs, feObj: this.params.feObj, editor: this.params.editor}, {styles: [mainView.params, 'styles']})
    html += '</div>'
    return html
  },
  init: function () {
    this.getEmptyState = getEmptyState
    this.setProp = (element, state, prop, value) => {
      // //console.log('stylesJSON', JSON.stringify(this.params.styles), {element, state, prop, value})
      if (!this.params.styles[element]) this.params.styles[element] = {}
      if (!this.params.styles[element][state]) this.params.styles[element][state] = getEmptyState()
      if (this.params.styles[element][state].classes[prop] === value) delete this.params.styles[element][state].classes[prop]
      else this.params.styles[element][state].classes[prop] = value
      this.param('styles', this.params.styles)
      // //console.log('stylesJSON', this.params.trackedViews, JSON.stringify(this.params.styles), this.usedParams, {element, state, prop, value})
    // this.domUpdate()
      // this.params.feObj.body.domUpdate()
    }
  },
  defaultParams: { tabs: [] }
}
