import styleFw from 'AdvHtmlEditor/templates/framework.js'
export default {
  name: 'pages/UI',
  render: async function (params) {
    var contents = async function () {
      let html = '<div>'
      html += `
      <h3>BASIC FRAMEWORK</h3>
      <textarea cols=40 rows=10>`
      for (let i in styleFw) {
        html += '/*' + i + '*/\n'
        for (let ii in styleFw[i].classes) {
          html += `.base_${i}_${ii},.hover_${i}_${ii}:hover{${styleFw[i].classes[ii].css}} \n`
        }

        html += '\n'
      }
      html += `</textarea>`
      html += `<div>${await this.viewRender('ui/input', { name: `input1`, value: `aaa`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `text`}) +
      await this.viewRender('ui/input', { name: `input2`, label: `aaa`, value: `test2`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `select`, items: ['test1', 'test2', 'test3']}) +
      await this.viewRender('ui/input', { name: `input3`, label: `aaa`, value: `test2`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `select`, items: [{label: 'labeltest', value: 'test'}, {label: 'labeltest2', value: 'test2'}, {label: 'labeltest3', value: 'test3'}]}) +
      await this.viewRender('ui/input', { name: `input4`, label: `aaa`, value: [`test2`, `test3`], schema: { 'type': 'array' }, type: `select`, multiple: true, items: [{label: 'labeltest', value: 'test'}, {label: 'labeltest2', value: 'test2'}, {label: 'labeltest3', value: 'test3'}]}) +
      await this.viewRender('ui/input', { name: `input5`, label: `aaa`, value: `test2`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `checkbox`}) +
      await this.viewRender('ui/input', { name: `input6`, label: `aaa`, value: 10, step: 10, type: `number`, schema: { 'type': 'number', 'minimum': 0, 'maximum': 100 }, min: 0, max: 100}) +
      await this.viewRender('ui/input', { name: `input7`, label: `aaa`, value: 10, step: 10, type: `range`, schema: { 'type': 'number', 'minimum': 0, 'maximum': 100 }, min: 0, max: 100}) +
      await this.viewRender('ui/input', { name: `input8`, label: `aaa`, value: `#ff4422`, schema: { 'type': 'string' }, type: `color`}) +
      await this.viewRender('ui/input', { name: `input9`, label: `aaa`, value: `test2`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `radio`})}
      </div>`
      return html
    }
    var onSubmit = function (event) {
      //console.log('form onSubmit', {values: this.values, isValid: this.isValid})
    }
    var v_form = await this.viewRender('ui/form', {contents, onSubmit})
    // this.log('ContainerPanelEdit', this, v_form)
    return `<div>${v_form}</div>`
  },
  defaultParams: { }
}
