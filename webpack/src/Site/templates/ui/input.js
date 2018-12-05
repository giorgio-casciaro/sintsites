var Ajv = require('ajv')
var ajv = new Ajv({coerceTypes: true})

export default {
  name: 'ui/input',
  render: async function (params) {
    var inputType = this.param('type')
    var inputBox
    if (this.param('label')) var label = `<label for="${this.param('id')}" >${this.param('label')}</label>`
    if (inputType === 'select') {
      var itemSelected = (item) => {
        if (this.param('multiple') && this.param('value').indexOf(item.value || item) >= 0) return 'selected'
        else if (item.value === this.param('value') || item === this.param('value')) return 'selected'
        return ''
      }
      inputBox = `<select ${this.param('multiple') ? 'multiple' : ''} class="inputBox" name="${this.param('name')}" id="${this.param('id')}" placeholder="${this.param('placeholder')}" >
      ${this.param('items').map((item) => `<option value="${item.value || item}" ${itemSelected(item)}>${item.label || item.value || item}</option>`
      ).join('')}
      </select>`
    // } else if (inputType === 'checkbox') {
    //   inputBox = `<input class="inputBox" id="${this.param('id')}" name="${this.param('name')}" placeholder="${this.param('placeholder')}" type="radio" value="${this.param('value')}" />`
    // } else if (inputType === 'radio') {
    //   inputBox = `<input class="inputBox" id="${this.param('id')}" name="${this.param('name')}" placeholder="${this.param('placeholder')}" type="checkbox" value="${this.param('value')}" />`
    } else if (inputType === 'textarea') {
      inputBox = `<textarea class="inputBox" id="${this.param('id')}" name="${this.param('name')}" placeholder="${this.param('placeholder')}" >${this.param('value')}</textarea>`
    } else {
      inputBox = `<input class="inputBox" id="${this.param('id')}" name="${this.param('name')}" min="${this.param('min')}" max="${this.param('max')}" placeholder="${this.param('placeholder')}" type="${this.param('type')}" value="${this.param('value')}" />`
    }
    return `<div class="${this.param('classes').join(' ')}">${label || ''}${inputBox}<div class="errors"></div></div>`
  },
  init: function () {
    if (!this.params.id) this.params.id = Math.random()
    if (!this.params.trackid) this.params.trackid = this.params.id
  },
  domInit: function (dom) {
    // this.log('inputDomInit')
    dom.setAttribute('input_name', this.params.name)
    var $input = dom.querySelector('.inputBox')
    var $errors = dom.querySelector('.errors')
    var onInput = () => {
      var value
      if (this.params.multiple)value = Array.from($input.options).filter(option => option.selected).map(option => option.value)
      else value = $input.value
      dom.setAttribute('input_value', JSON.stringify(value))
      dom.setAttribute('empty', (value === ''))
      //console.log('value', value)
      if (this.params.schema) {
        var valid = ajv.validate(this.params.schema, value)
        dom.setAttribute('valid', valid)
        if (!valid) {
          //console.log('not valid', this.params.schema, ajv.errors)
          ajv.errors.forEach((ajvError) => {
            while ($errors.firstChild) $errors.removeChild($errors.firstChild)
            var $error = document.createElement('div')
            $error.innerHTML = ajvError.message
            $errors.appendChild($error)
          })
        } else {
          while ($errors.firstChild) $errors.removeChild($errors.firstChild)
          //console.log('valid', this.params.schema, value)
        }
      }
    }
    $input.addEventListener('input', onInput)
    onInput()
  },
  defaultParams: { contents: '', id: null, label: null, placeholder: '', min: '', max: '', schema: null, value: '', name: '', classes: ['inputView'], type: 'text', items: [] },
  css: `
  .inputView[valid='true']{ border:1px solid #00ff00}
  .inputView[valid='false']{ border:1px solid #ff0000}
  `
}
// await this.param('contents').call(this)
