import styleEditorTemplateData from '../templates/styleEditor'
import SintTemplate from 'SintViews/SintTemplate.class'

export default {
  name: 'AdvHtmlEditor/panel',
  render: async function (params) {
    return `<div>
    ${await this.viewRender('ui/tabs', {
      trackid: 'panelTabs',
      tabs: [this.paramsTab, this.stylesTab, this.actionsTab],
      feObj: this.params.feObj,
      editor: this.params.editor
    })}
    <a>SAVE</a>
    </div>`
  },
  init: function () {
    this.paramsTab = {
      trackid: 'paramsTab',
      title: 'Params',
      description: 'basic object parameters',
      contents: this.params.paramsTabContents
    }
    let styleEditorTemplate = new SintTemplate(styleEditorTemplateData)
    this.stylesTab = {
      trackid: 'stylesTab',
      title: 'Styles',
      description: 'object appereance',
      contents: async function () {
        var html = ''
        var elementsDefs = this.params.feObj.objType.defs
        html += await this.viewRender(styleEditorTemplate, {trackid: 'stylesTabs', elementsDefs, feObj: this.params.feObj, editor: this.params.editor}, { styles: [this.params.feObj, 'styles'] })
        return html
      }
    }
    this.actionsTab = {
      trackid: 'actionsTab',
      title: 'Actions',
      description: 'reactions to object events',
      contents: async function () {
        return `
      thi is your form
      ${await this.viewRender('ui/input', { name: `input1`, value: `aaa`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `
        text `})}
      `
      }
    }
  },
  defaultParams: { tabs: [] }
}
