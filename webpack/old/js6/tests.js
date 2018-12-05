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
  await new Promise(resolve => setTimeout(resolve, 500))
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
var getTemplate = template => {
  if (templatesDb[template]) return new SintTemplate(templatesDb[template])
  else throw new Error('TEMPLATE NOT DEFINED: ' + template)
}
SintView.prototype.getTemplate = getTemplate
// SintView.prototype.getTemplate = getTemplate

var startTest = async () => {
  var $testArea = document.querySelector('.testArea')
  var view

  await makeTest(
    'TitledParagraph',
    async () => {
      view = new SintView('titledParagraph', {
        title: 'title',
        level: 2,
        contents: 'contents'
      })
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
      view = new SintView('titledParagraph', {
        title: 'title',
        level: 2,
        contents: function (params) {
          log('TitledParagraph in contents', this)
          return `contents 1 ${this.viewRender('titledParagraph', {
            title: 'title',
            level: 3,
            contents: `contents 2`
          })}`
        }
      })
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
      view = new SintView('titledParagraph', {
        title: new SintBinding(article, 'title', 'titledParagraph'),
        level: 2,
        contents: `contents 1`
      })
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
      view = new SintView('list', {
        items: new SintBinding(list, 'items', 'list'),
        contents: `contents 1`
      })
      $testArea.innerHTML = ''
      $testArea.appendChild(view.renderDom())
      list.items.push('list2')
      list.items = list.items
      log('$testArea.innerHTML', $testArea.innerHTML)
    },
    () =>
      $testArea.innerHTML ===
      '<ul item_length="2"><li>list1</li><li>list2</li></ul>'
  )
  var form = { value: 'inputValue' }
  var view
  await makeTest(
    'form inputText create and update binding',
    async () => {
      view = new SintView('inputText', {
        value: new SintBinding(form, 'value', 'inputText'),
        contents: `contents 1`
      })
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
  var initialDomInput

  await makeTest(
    'form update by value',
    async () => {
      $testArea.innerHTML = new SintView('formName', {
        trackid: 'mainForm',
        name: form.name,
        contents: 'contents'
      }).render()
      view = new SintView('formName', {
        trackid: 'mainForm',
        name: new SintBinding(form, 'name', 'mainForm'),
        contents: 'contents'
      })
      $testArea.replaceChild(view.renderDom(), $testArea.firstChild)
      initialDomInput = $testArea.querySelector('input')
      log('form update by value')
      // view.params.name = 'name 1'
      form.name = 'name 1'
      log('form', form, initialDomInput)
    },
    () =>
      view.params.name === 'name 1' &&
      initialDomInput === $testArea.querySelector('input') &&
      $testArea.querySelector('input').value === 'name 1'
  )
  console.log(view.params.name, initialDomInput)
  await makeTest(
    'form update by dom',
    async () => {
      $testArea.querySelector('input').value = 'name 2'
      $testArea
        .querySelector('input')
        .dispatchEvent(new Event('input', { bubbles: true }))
      log('form.name', form.name, form)
    },
    () => form.name === 'name 2'
  )
  log('form.name', form.name, form)

  var form = { name: 'name 0' }
  log('form', form)
  var initialDomInput

  await makeTest(
    'complexFormName form update by value',
    async () => {
      $testArea.innerHTML = new SintView('complexFormName', {
        trackid: 'mainForm',
        name: form.name,
        form: form,
        contents: '<p>complexFormName template</p>'
      }).render()

      view = new SintView('complexFormName', {
        trackid: 'mainForm',
        name: new SintBinding(form, 'name', 'mainForm'),
        form: form,
        contents: '<p>complexFormName template</p>'
      })
      $testArea.replaceChild(view.renderDom(), $testArea.firstChild)
      $testArea.querySelector('input').value = 'name 1'
      $testArea
        .querySelector('input')
        .dispatchEvent(new Event('input', { bubbles: true }))
    },
    () =>
      view.params.name === 'name 0' &&
      $testArea.querySelector('input').value === 'name 1'
  )
  console.log(view.params.name, initialDomInput)
  await makeTest(
    'complexFormName update by dom',
    async () => {
      $testArea
        .querySelector('a.save')
        .dispatchEvent(new Event('click', { bubbles: true }))
    },
    () => form.name === 'name 1'
  )

  var form = { name: 'name 0', message: 'message 0' }
  log('form', form)
  var initialDomInput

  await makeTest(
    'complexFormMultiInput ',
    async () => {
      $testArea.innerHTML = new SintView('complexFormMultiInput', {
        trackid: 'mainForm',
        submit: () => (newForm) => {
          console.log('newForm', newForm)
        },
        obj: form,
        fields: [{ field: 'name', type: 'text' }, { field: 'message', type: 'textarea' }],
        contents: '<p>complexFormMultiInput template</p>'
      }).render()

      view = new SintView('complexFormMultiInput', {
        trackid: 'mainForm',
        submit: () => function (newForm) {
          this.params.obj = newForm
          console.log('newForm', newForm, this.params)
        },
        obj: form,
        fields: [{ label: 'name', field: 'name', type: 'text' }, { field: 'message', type: 'textarea' }, { field: 'message', type: 'select', options: [{label: 'opt value1', value: 'opt value1' }, {label: 'opt value2', value: 'opt value2' }] }],
        contents: '<p>complexFormMultiInput template</p>'
      })
      $testArea.replaceChild(view.renderDom(), $testArea.firstChild)
      // $testArea.querySelector('input').value = 'name 1'
      // $testArea
      //   .querySelector('input')
      //   .dispatchEvent(new Event('input', { bubbles: true }))
    },
    () =>
      view.params.name === 'name 0' &&
      $testArea.querySelector('input').value === 'name 1'
  )
  // console.log(view.params.name, initialDomInput)
  // await makeTest(
  //   'complexFormName update by dom',
  //   async () => {
  //     $testArea
  //       .querySelector('a.save')
  //       .dispatchEvent(new Event('click', { bubbles: true }))
  //   },
  //   () => form.name === 'name 1'
  // )
}
startTest()
