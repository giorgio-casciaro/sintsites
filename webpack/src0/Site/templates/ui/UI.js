export default {
  name: 'ui/UI',
  render: async function (params) {
    return `<div>
        ${await this.viewRender('input', { name: `input1`, value: `aaa`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `text`}) +
        await this.viewRender('input', { name: `input2`, label: `aaa`, value: `test2`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `select`, items: ['test1', 'test2', 'test3']}) +
        await this.viewRender('input', { name: `input3`, label: `aaa`, value: `test2`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `select`, items: [{label: 'labeltest', value: 'test'}, {label: 'labeltest2', value: 'test2'}, {label: 'labeltest3', value: 'test3'}]}) +
        await this.viewRender('input', { name: `input4`, label: `aaa`, value: [`test2`, `test3`], schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `select`, multiple: true, items: [{label: 'labeltest', value: 'test'}, {label: 'labeltest2', value: 'test2'}, {label: 'labeltest3', value: 'test3'}]}) +
        await this.viewRender('input', { name: `input5`, label: `aaa`, value: `test2`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `checkbox`}) +
        await this.viewRender('input', { name: `input6`, label: `aaa`, value: 10, step: 10, type: `number`, schema: { 'type': 'number', 'minimum': 0, 'maximum': 100 }, min: 0, max: 100}) +
        await this.viewRender('input', { name: `input7`, label: `aaa`, value: 10, step: 10, type: `range`, schema: { 'type': 'number', 'minimum': 0, 'maximum': 100 }, min: 0, max: 100}) +
        await this.viewRender('input', { name: `input8`, label: `aaa`, value: `#ff4422`, schema: { 'type': 'string' }, type: `color`}) +
        await this.viewRender('input', { name: `input9`, label: `aaa`, value: `test2`, schema: { 'type': 'string', 'minLength': 2, 'maxLength': 3 }, type: `radio`})}
        </div>`
  },
  init: function () {},
  domInit: function (dom) {},
  defaultParams: {},
  css: ``
}
// await this.param('contents').call(this)
