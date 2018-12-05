import SintTemplate from 'SintViews/SintTemplate.class'
import SintView from 'SintViews/SintView.class'
import SintBinding from 'SintViews/SintBinding.class'
import 'AdvHtmlEditor/templates/framework.css'

var TemplatesDb = {}
function log () {
  //console.log.apply(console, ['/ MAIN / '].concat(Array.from(arguments)))
}

var getTemplate = async template => {
  if(!TemplatesDb[template]){
    let templateData=await import("./templates/"+template)
    log('getTemplate', template,templateData.default)
    TemplatesDb[template]=new SintTemplate(templateData.default)
  }
  if (TemplatesDb[template]) return TemplatesDb[template]
  else throw new Error('TEMPLATE NOT DEFINED: ' + template)
}

var setTemplateCss = function () {
  if (this.template.css && !window.app.params.allCss[this.template.name]) {
    window.app.params.allCss[this.template.name] = this.template.css
    window.app.params.allCss = window.app.params.allCss
  }
  // log('setTemplateCss window.app.params.allCss', JSON.stringify(window.app.params.allCss))
}
SintView.prototype.getTemplate = getTemplate
SintView.prototype.setTemplateCss = setTemplateCss

// -------------------------------------

var contentsFunc = async function () {
  return `<div>
  <div><nav><a onclick="window.app.param('page','pages/editor')">HOME</a><a onclick="window.app.param('page','pages/UI')">SHOW UI</a></nav></div>
  <div id="siteBody">${this.param('page')}${await this.viewRender(this.param('page'),{trackid:this.param('page')})}</div>
  <style>${Object.values(this.param('allCss')).join('\n')}</style>
</div>`
}
// log('window.app.params.allCss3', JSON.stringify(window.app.params.allCss))
// SIMULATE SERVER RENDERING
// document.body.innerHTML = new SintView('contents', {
//   trackid: 'MainSite',
//   contents: () => contentsFunc
// }).render()



const pageRender=async function(){
  // SIMULATE SERVER RENDERING
  var contentsTemplate=await SintView.prototype.getTemplate('ui/contents')
  //console.log("contentsTemplate",contentsTemplate)
  window.app = new SintView(contentsTemplate, { trackid: 'MainSite', contents: contentsFunc, allCss: {}, page: 'pages/editor'})
  document.body.replaceChild(await window.app.renderDom(), document.body.childNodes[0])
}
 pageRender()
