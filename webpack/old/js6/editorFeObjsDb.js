var feObjsDb = {
  Image: {
    defaultParams: { src: '', title: '', alt: '' },
    body: {
      name: 'ImageBody',
      render: function () {
        return `<img feobjid='${this.feObj.feobjid}' src='${this.param('feObjParams').src || ''}' title='${this.param('feObjParams').title || ''}' alt='${this.param('feObjParams').alt || ''}' ></img>`
      },
      domInit: function (dom) {
        dom.addEventListener('click', (event) => {
          if (event.selectFeObject) return false
          event.selectFeObject = true
          this.editor.selectFeObject(this.feObj)
        })
      },
      css: `
          img[feobjid][src='']{ width:100px; height:100px; background:#ccc; display:inline-block}
          `
    },
    ui: {
      name: 'ImageUi',
      render: function () {
        return `<div class="ui_container"><a onclick="this.closest('[trackid]').sintView.feObj.delete()">delete</a><a onclick="this.closest('.ui_container').sintView.feObj.openPanel('edit')">edit</a></div>`
      }
    },
    panel_edit: {
      name: 'ImagePanelEdit',
      render: function () {
        this.log('this.feObj', this, this.feObj)
        return `<div>${this.domUpdateId}<input type="text"  oninput="this.closest('[trackid]').sintView.feObj.param('src',this.value)" /></div>`
      }
    }
  },
  Container: {
    defaultParams: { classes: [''] },
    body: {
      name: 'ContainerBody',
      render: function () {
        return `<div class="container ${this.param('feObjParams').classes.join()}" feobjid='${this.feObj.feobjid}'>${this.param('feObjContents')()}</div>`
      },
      domInit: function (dom) {
        dom.addEventListener('click', (event) => {
          if (event.selectFeObject) return false
          event.selectFeObject = true
          this.editor.selectFeObject(this.feObj)
        })
      },
      css: `
          .container{ border:1px solid #000}
          `
    },
    ui: {
      name: 'ContainerUi',
      render: function () {
        return `<div class="ui_container"><a onclick="this.closest('[trackid]').sintView.feObj.delete()">delete</a><a onclick="this.closest('.ui_container').sintView.feObj.openPanel('edit')">edit</a></div>`
      }
    },
    panel_edit: {
      name: 'ContainerPanelEdit',
      render: function () {
        this.log('this.feObj', this, this.feObj)
        return `<div>${this.domUpdateId}<input type="text" value="${this.param('feObjParams').classes.join(' ')}" oninput="this.closest('[trackid]').sintView.feObj.param('classes',this.value.split(' '))" ></input></div>`
      }
    }
  }
}
