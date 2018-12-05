var templatesDb = {
  titledParagraph: {
    name: 'titledParagraph',
    render: function (params) {
      return `<div><h${params.level}>${params.title}</h${
        params.level
      }><div class="contents">${params.contents}</div></div>`
    },
    defaultParams: { title: 'title', level: 1 },
    defaultData: {},
    domQueryContents: 'div.contents',
    init: async function () {
      this.log('template init')
    },
    domInit: function (params) {
      this.log('template domInit')
    }
    // domUpdate: params => this.log('template domUpdate')
  },
  list: {
    name: 'list',
    render: function (params) {
      var items = params.items.valueOf()
      return `<ul item_length="${items.length}">${items.reduce(
        (string, item) => string + `<li>${item}</li>`,
        ''
      )}</ul>`
    },
    defaultParams: { items: [] },
    defaultData: {},
    init: async function () {
      this.log('template init')
    },
    domInit: function (params) {
      this.log('template domInit')
    }
    // domUpdate: params => this.log('template domUpdate')
  },
  inputText: {
    name: 'inputText',
    render: function (params) {
      return `<div><label>${params.label}</label><input value="${
        params.value
      }"/></div>`
    },
    defaultParams: { value: '', label: 'label' },
    defaultData: {},
    init: async function () {
      this.log('template init')
    },
    domInit: function (dom) {
      var input = dom.querySelector('input')
      input.addEventListener('input', () => {
        this.log('addEventListener input value', input.value)
        this.params.value = input.value
      })
      this.log('template domInit', this)
    },
    domUpdate: function (dom, fields) {
      this.log('inputText domUpdate', fields)
      if (fields['value']) dom.querySelector('input').value = fields['value']
    }
  },
  formName: {
    name: 'formName',
    _render: function (params) {
      return `<form >${params.name}${params.contents}</form>`
    },
    render: function (params) {
      return `<form >${params.name} ${this.viewRender('inputText', {
        value: this.bind('name', 'inputText'),
        label: 'insert your name',
        trackid: 'inputText1'
      })}${params.contents}</form>`
    },
    defaultParams: { name: 'test' },
    defaultData: {},
    init: async function () {
      this.log('template init')
    },
    domInit: function (dom) {
      // dom.addEventListener('input', () => {
      //   this.log('addEventListener input value', this.dom.value)
      //   this.params.value = this.dom.value
      // })
      this.log('template domInit', this)
    }
    // domUpdate: function (dom, fields) {
    //   // this.log('inputText domUpdate', fields)
    //   // if (fields['value'])dom.value = fields['value']
    // }
  },
  complexFormName: {
    name: 'complexFormName',
    render: function (params) {
      var html = '<form >'
      html += this.param('name')
      html += JSON.stringify(this.param('form'))
      html += this.param('contents')
      this.log('render viewRender 1')
      let inputText = this.viewRender('inputText', {
        value: this.bind('localName', 'inputText'),
        label: 'insert your name',
        trackid: 'inputText1'
      })
      html += inputText
      this.log('render viewRender 2', inputText)
      html += '<a class="save" onclick="this.parentNode.sintView.params.name=this.parentNode.sintView.params.localName">save</a>'
      // html += '<a onclick="console.log(this.parentNode.sintView.params)">save</a>'
      html += this.param('contents')
      html += '</form>'
      this.log('render viewRender 3', html)
      return html
    },
    defaultParams: { name: 'test' },
    defaultData: {},
    init: async function () {
      this.params.localName = this.params.name
      this.log('template init', JSON.stringify(this.params))
    }
  },
  complexFormMultiInput: {
    name: 'complexFormMultiInput',
    render: function (params) {
      var html = '<form >'
      var exec = (func) => func()
      var objCopy = this.param('objCopy')
      html += JSON.stringify(this.param('obj'))
      html += JSON.stringify(this.param('objCopy'))
      this.log('render viewRender 1')
      html += '<div class="inputsContainer" >'
      this.param('fields').forEach((field) => {
        html += `<div class="inputContainer" >
        ${field.label ? `<label>${field.label}</label>` : ''}
        ${
          (!field.type || field.type === 'text') ? `<input name="${field.field}" type="text" value="${objCopy[field.field]}"/>` :
          field.type === 'textarea' ? `<textarea name="${field.field}">${objCopy[field.field]}</textarea>` :
          field.type === 'select' ? `<select name="${field.field}">${
            field.options.map((option) => `<option value="${option.value}">${option.label}</option>`).join()
          }</select>` : ''
        }
        </div>`
      })
      html += '</div>'

      // let inputText = this.viewRender('inputText', {
      //   value: this.bind('localName', 'inputText'),
      //   label: 'insert your name',
      //   trackid: 'inputText1'
      // })
      // html += inputText
      // this.log('render viewRender 2', inputText)
      html += '<a class="submit" >save</a>'
      // html += '<a onclick="console.log(this.parentNode.sintView.params)">save</a>'
      html += this.param('contents')
      html += '</form>'
      this.log('render viewRender 3', html)
      return html
    },
    defaultParams: { name: 'test' },
    defaultData: {},
    init: async function () {
      this.params.objCopy = Object.assign({}, this.params.obj)
      this.log('template init', JSON.stringify(this.params))
    },
    domInit: function (dom) {
      dom.addEventListener('change', (event, event2) => {
        this.params.objCopy[event.srcElement.getAttribute('name')] = event.srcElement.value
        this.log('addEventListener input value', event.srcElement.value, event.srcElement.getAttribute('name'))
        var inputsContainer = dom.querySelector('div.inputsContainer')
        document.body.appendChild(inputsContainer)
        this.domUpdate('objCopy')
        // // this.domReplaceNode(inputsContainer, dom)
        this.dom.appendChild(inputsContainer)
        // this.params.value = this.dom.value
      })
      dom.querySelector('a.submit').addEventListener('click', (event, event2) => {
        this.log('addEventListener submit click')
        // this.params.value = this.dom.value
      })
      this.log('template domInit', this)
    }
  }
}
