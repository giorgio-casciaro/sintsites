export default {
  name: 'Image',
  defaultParams: { src: '', title: '', alt: '' },
  body: {
    name: 'ImageBody',
    render: async function () {
      return `<img feobjid='${this.feObj.feobjid}' src='${this.param('feObjParams').src || ''}' title='${this.param('feObjParams').title || ''}' alt='${this.param('feObjParams').alt || ''}' ></img>`
    },
    domInit: function (dom) {
      dom.addEventListener('click', (event) => {
        if (event.selectFeObj) return false
        event.selectFeObj = true
        this.editor.selectFeObj(this.feObj)
      })
    },
    css: `
        img[feobjid][src='']{ width:100px; height:100px; background:#ccc; display:inline-block}
        `
  },
  ui: {
    name: 'ImageUi',
    render: async function () {
      return `<div class="ui_container"><a onclick="this.closest('[trackid]').sintView.feObj.delete()">delete</a><a onclick="this.closest('.ui_container').sintView.feObj.openPanel('edit')">edit</a></div>`
    }
  },
  panel_edit: {
    name: 'ImagePanelEdit',
    render: async function () {
      this.log('this.feObj', this, this.feObj)
      // <input type="text"  oninput="this.closest('[trackid]').sintView.feObj.param('src',this.value)" />
      var contents = `
      thi is your form
        ${
          await this.viewRender('ui/input', {label: `aaa`, value: `aaa`}) +
          await this.viewRender('ui/input', {label: `aaa`, value: `aaa`}) +
          await this.viewRender('ui/input', {label: `aaa`, value: `aaa`})
        }
        `
      return `<div>${
        await this.viewRender('ui/form', {contents})
      }</div>`
    }
  }
}
