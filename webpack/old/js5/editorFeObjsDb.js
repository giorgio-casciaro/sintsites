var feObjsDb = {
  Image: {
    body: {
      render: function (params) {
        return `<span><img feobjid='${this.feObj.feobjid}' src='${this.param('src')}' title='${this.param('title')}' alt='${this.param('alt')}' ></img></span>`
      },
      domInit: function (dom) {
        dom.addEventListener('click', () => {
          this.editor.selectFeObject(this.feObj)
        })
      },
      defaultParams: { src: '', title: '', alt: '' },
      css: `
          img[feobjid][src='']{ width:100px; height:100px; background:#ccc; display:inline-block}
          `
    },
    ui: {
      render: function (params) {
        return `<div>
      <!--input type="text"  onchange="this.sintView.feObj(${this.feObj.feobjid}).params.src=this.value"/-->
      <a onclick="console.log('this.sintView',this.sintView);this.sintView.feObj(${this.feObj.feobjid}).delete()">delete</a><a onclick="this.sintView.feObj(${this.feObj.feobjid}).openPanel('edit')">edit</a></div>`
      }
    },
    panel_edit: {
      render: function (params) {
        return `<div>
      <!--input type="text"  onchange="this.sintView.feObj(${this.feObj.feobjid}).params.src=this.value"/-->
      <a onclick="this.sintView.feObj(${this.feObj.feobjid}).delete()">delete</a><a onclick="this.sintView.feObj(${this.feObj.feobjid}).openPanel('edit')">edit</a></div>`
      }
    }
  }
}
