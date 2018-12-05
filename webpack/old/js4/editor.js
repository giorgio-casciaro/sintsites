function log () {
  console.log.apply(console, ['/ MAIN / '].concat(Array.from(arguments)))
}

var getTemplate = template => {
  if (templatesDb[template]) return new SintTemplate(templatesDb[template])
  else throw new Error('TEMPLATE NOT DEFINED: ' + template)
}

var setTemplateCss = function () {
  if (this.template.css && !page.allCss[this.template.name]) {
    page.allCss[this.template.name] = this.template.css
    page.allCss = page.allCss
  }
  log('setTemplateCss page.allCss', JSON.stringify(page.allCss))
}
SintView.prototype.getTemplate = getTemplate
SintView.prototype.setTemplateCss = setTemplateCss

var page = {
  title: 'page title',
  contents: '<p>page contents</p>',
  allCss: {}
}
var feObjects = {
  title: 'page title',
  contents: '<p>page contents</p>'
}

var contentsFunc = function () {
  return `<div>
  <div>menu</div>
  <div>${this.viewRender('advEditor', {contents: page.contents})}</div>
  <div>panel</div>
  <style>${Object.values(this.param('allCss')).join('\n')}</style>
</div>`
}
log('page.allCss3', JSON.stringify(page.allCss))
// SIMULATE SERVER RENDERING
// document.body.innerHTML = new SintView('contents', {
//   trackid: 'MainSite',
//   contents: () => contentsFunc
// }).render()

// SIMULATE SERVER RENDERING
var appDom = new SintView('contents', {
  trackid: 'MainSite',
  contents: () => contentsFunc, allCss: new SintBinding(page, 'allCss')
}).renderDom()
document.body.replaceChild(appDom, document.body.childNodes[0])
