import SintTemplate from 'SintViews/SintTemplate.class'

export default {
  name: 'Container',
  defaultParams: {
      name:"Container"
  },
  defaultActions: [
    {
      events:["click"],
      action:"js",
      params:{
        code:"alert(1)"
      }
    }
  ],
  defs: {
    main:{
      name:"Main Element",
      description:"Container Style",
      styleStates:["base","phones_v","phones_o","tablets_v","tablets_o","desktop"],
      actionsEvents:["click"]
    },
    child:{
      name:"Child Element",
      description:"Child Style",
      styleStates:["base","phones_v","phones_o","tablets_v","tablets_o","desktop"],
      actionsEvents:["click"]
    }
  },
  defaultStyles: {
      main:{
          base:{
            classes:{width:"s"},
            customClasses: [],
            customCss:""
          }
        }
  },
  init:function(){

  },
  body: {
    name: 'ContainerBody',
    render: async function() {
        return `<div class="container ${this.params.feObj.getClasses("main").join(" ")}"  style="${this.params.feObj.getStyle("main")}"  feobjid='${this.params.feObj.feobjid}'>${await this.param('feObj').contents()}</div>`
      },
      domInit: function(dom) {
        dom.addEventListener('click', (event) => {
          if (event.selectFeObj) return false
          event.selectFeObj = true
          this.params.editor.selectFeObj(this.params.feObj)
        })
      },
      css: `
        .container{ border:1px solid #000}
        `
  },
  ui: {
    name: 'ContainerUi',
    domInit: function(dom) {
      Array.from(dom.getElementsByTagName('a')).forEach(element=>element.feObj=this.params.feObj)
    },
    render: async function() {
      return `<div class="ui_container"><a onclick="this.feObj.delete()">delete</a><a onclick="this.feObj.openPanel('edit')">edit</a></div>`
    }
  },
  panel_edit: {
    name: 'PanelEdit',
    render: async function() {
      // <input type="text"  oninput="this.closest('[trackid]').sintView.feObj.param('src',this.value)" />
      let templateData = await import('../templates/panel')
      let template = new SintTemplate(templateData.default)
      var paramsTabContents= async function () { return `
        ${await this.viewRender('ui/input', { label: `Name`, name: `name`, value: this.params.feObj.param('name'), schema: { 'type': 'string', 'minLength': 1}, type: `text`})}
        ${await this.viewRender('ui/input', { label: `Special Classes`, name: `customClasses`, value: this.params.feObj.param('customClasses'), schema: { 'type': 'string'}, type: `text`})}`
      }
      var panel = await this.viewRender(template, {
        trackid:"PanelEdit",
        feObj:this.params.feObj,
        editor:this.params.editor,
        paramsTabContents
      })
      this.log('ContainerPanelEdit', this, panel)
      return `<div>${panel}</div>`
    }
  }
}
