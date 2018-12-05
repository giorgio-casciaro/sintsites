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
    init: async function (params) {
      log('template init')
    },
    domInit: function (params) {
      log('template domInit')
    }
    // domUpdate: params => log('template domUpdate')
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
    init: async function (params) {
      log('template init')
    },
    domInit: function (params) {
      log('template domInit')
    }
    // domUpdate: params => log('template domUpdate')
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
    init: async function (params) {
      log('template init')
    },
    domInit: function (dom) {
      var input = dom.querySelector('input')
      input.addEventListener('input', () => {
        log('addEventListener input value', input.value)
        this.params.value = input.value
      })
      log('template domInit', this)
    },
    domUpdate: function (dom, fields) {
      log('inputText domUpdate', fields)
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
    init: async function (params) {
      log('template init')
    },
    domInit: function (dom) {
      // dom.addEventListener('input', () => {
      //   log('addEventListener input value', this.dom.value)
      //   this.params.value = this.dom.value
      // })
      log('template domInit', this)
    }
    // domUpdate: function (dom, fields) {
    //   // log('inputText domUpdate', fields)
    //   // if (fields['value'])dom.value = fields['value']
    // }
  }
}
