function log () {
  console.log.apply(console, ['/ MAIN / '].concat(Array.from(arguments)))
}

var testN = 0
var testError = false
const makeTest = async (string, code, test) => {
  testN++
  if (testError) return log(`SKIP TEST ${testN} ${string} `)

  console.group(`TEST ${testN} ${string} START`)
  await code()
  await new Promise((resolve) => setTimeout(resolve, 500))
  if (test()) {
    log(`TEST ${testN} SUCCESS`)
  } else {
    testError = true
    log(`TEST ${testN} ERROR`)
    log(`TEST ${testN} CODE`, code.toString())
    log(`TEST ${testN} TEST`, test.toString())
    // setTimeout(() => window.location.reload(), 60000)
  }
  console.groupEnd()
}
var getTemplate = template => { if (templatesDb[template]) return new SintTemplate(templatesDb[template]); else throw new Error('TEMPLATE NOT DEFINED: ' + template) }
SintView.prototype.getTemplate = getTemplate
SintView.prototype.getTemplate = getTemplate

var templatesDb = {
  titledParagraph: {
    name: 'titledParagraph',
    render: function (params, contents) {
      return `<div><h${params.level}>${params.title}</h${
        params.level
      }><div class="contents">${contents()}</div></div>`
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
    render: function (params, contents) {
      var items = params.items.valueOf()
      return `<ul>${items.reduce(
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
    render: function (params, contents) {
      return `<div><label>${params.label}</label><input value="${params.value}"/></div>`
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
      if (fields['value'])dom.querySelector('input').value = fields['value']
    }
  },
  formName: {
    name: 'formName',
    render: function (params, contents) {
      return `<form >${this.viewRender('inputText', { value: new SintBinding(this.params, 'name'), label: 'insert your name' })}${contents()}</form>`
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
    },
    domUpdate: function (dom, fields) {
      // log('inputText domUpdate', fields)
      // if (fields['value'])dom.value = fields['value']
    }
  }
}

var startTest = async () => {
  var $testArea = document.querySelector('.testArea')

  await makeTest(
    'TitledParagraph',
    async () => {
      var view = new SintView(
        'titledParagraph',
        { title: 'title', level: 2 },
        params => `contents`
      )
      $testArea.innerHTML = view.render()
      log('$testArea.innerHTML', $testArea.innerHTML)
    },
    () =>
      $testArea.innerHTML ===
      '<div><h2>title</h2><div class="contents">contents</div></div>'
  )
  await makeTest(
    'TitledParagraph with TitledParagraph in contents',
    async () => {
      var view = new SintView(
        'titledParagraph',
        { title: 'title', level: 2 },
        function (params) {
          log('TitledParagraph in contents', this)
          return `contents 1 ${this.viewRender(
            'titledParagraph',
            { title: 'title', level: 3 },
            () => `contents 2`
          )}`
        }
      )
      $testArea.innerHTML = ''
      $testArea.appendChild(view.renderDom())
      log('$testArea.innerHTML', $testArea.innerHTML)
    },
    () =>
      $testArea.innerHTML ===
      '<div><h2>title</h2><div class="contents">contents 1 <div><h3>title</h3><div class="contents">contents 2</div></div></div></div>'
  )
  var article = { title: 'Article Title1' }
  await makeTest(
    'TitledParagraph with live props in contents',
    async () => {
      var view = new SintView(
        'titledParagraph',
        { title: new SintBinding(article, 'title'), level: 2 },
        params => `contents 1`
      )
      $testArea.innerHTML = ''
      $testArea.appendChild(view.renderDom())
      article.title = 'title2'
      log('$testArea.innerHTML', $testArea.innerHTML)
    },
    () =>
      $testArea.innerHTML ===
      '<div><h2>title2</h2><div class="contents">contents 1</div></div>'
  )
  var list = { items: ['list1'] }
  await makeTest(
    'list with live props',
    async () => {
      var view = new SintView(
        'list',
        { items: new SintBinding(list, 'items') },
        params => `contents 1`
      )
      $testArea.innerHTML = ''
      $testArea.appendChild(view.renderDom())
      list.items.push('list2')
      log('$testArea.innerHTML', $testArea.innerHTML)
    },
    () => $testArea.innerHTML === '<ul><li>list1</li><li>list2</li></ul>'
  )
  var form = { value: 'inputValue' }
  var view
  await makeTest(
    'form inputText create and update binding',
    async () => {
      view = new SintView(
        'inputText',
        { value: new SintBinding(form, 'value') },
        params => `contents 1`
      )
      $testArea.innerHTML = ''
      $testArea.appendChild(view.renderDom())
      form.value = 'inputValue 2'
      log('$testArea.innerHTML', $testArea.innerHTML)
    },
    () => $testArea.querySelector('input').value === 'inputValue 2'
  )

  await makeTest(
    'form inputText update',
    async () => {
      $testArea.querySelector('input').value = 'inputValue 3'
      $testArea
        .querySelector('input')
        .dispatchEvent(new Event('input', { bubbles: true }))
    },
    () => form.value === 'inputValue 3'
  )
  var form = { name: 'your form name' }
  log('form', form)

  await makeTest(
    'form update by value',
    async () => {
      view = new SintView('formName', { name: new SintBinding(form, 'name') })
      $testArea.innerHTML = ''
      $testArea.appendChild(view.renderDom())
      view.params.name = 'name 1'
      log('form', form)
    },
    () => form.name === 'name 1'
  )
  await makeTest(
    'form update by dom',
    async () => {
      $testArea.querySelector('input').value = 'name 2'
      $testArea
        .querySelector('input')
        .dispatchEvent(new Event('input', { bubbles: true }))
      log('form', form)
    },
    () => form.name === 'name 2'
  )
  log('form', form)
}
startTest()
