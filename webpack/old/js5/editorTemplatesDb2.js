
var templatesDb = {
  contents: {
    name: 'contents',
    render: function (params) {
      return `${this.param('contents').call(this)}`
    },
    defaultParams: { contents: () => () => '' }
  },
  advEditorUi: {
    name: 'contents',
    render: function (params) {
      return `<div>UI</div>`
    },
    defaultParams: { contents: () => () => '' }
  },
  feObjContainer: {
    name: 'feObjContainer',
    render: function (params) {
      return `<div feobjid='${this.param('feobjid')}'>${this.param('contents')}</div>`
    },
    init: function (params) {
      this.log('feObjContainer')
    },
    defaultParams: { contents: '' }
  },
  feObjImage: {
    name: 'feObjImage',
    render: function (params) {
      return `<img feobjid='${this.param('feobjid')}' src='${this.param('src')}' title='${this.param('title')}' alt='${this.param('alt')}' />`
    },
    ui: function (params) {
      return `<div>
      <!--input type="text"  onchange="this.sintView.feObj(${this.params.feobjid}).params.src=this.value"/-->
      <a onclick="this.sintView.feObj(${this.params.feobjid}).delete()">delete</a><a onclick="this.sintView.feObj(${this.params.feobjid}).openPanel('edit')">edit</a></div>` + this.template.name
    },
    init: function (params) {
      // this.updateUi()
      // this.showUi()
      this.log('feObjImage')
    },
    domInit: function (dom) {
      dom.addEventListener('click', () => {
        this.editor.selectFeObject(this)
      })
    },
    defaultParams: { src: '', title: '', alt: '' },
    css: `
    img[feobjid][src='']{ width:100px; height:100px; background:#ccc; display:inline-block}
    `
  },
  advEditorBody: {
    name: 'advEditorBody',
    render: function (params) {
      if (this.editor.selectedFeObject) {
        var selectedFeObjectRect = this.editor.selectedFeObject.dom.getBoundingClientRect()
        var advEditorBodyRect = this.advEditorBody.getBoundingClientRect()
        this.log('selectedFeObjectRect', selectedFeObjectRect)
        this.log('advEditorBodyRect', advEditorBodyRect)
        var relativeBoundingClientRect = {
          left: selectedFeObjectRect.left - advEditorBodyRect.left,
          top: selectedFeObjectRect.top - advEditorBodyRect.top,
          right: selectedFeObjectRect.right - advEditorBodyRect.left,
          bottom: selectedFeObjectRect.bottom - advEditorBodyRect.top
        }
      }
      return `<div class="advEditor">
        <div class="advEditorUi" >
          <a onclick="this.sintView.editor.domManipulation.applyCommand(this.sintView.editor.domManipulation.htmlContainer,{string:'<STRONG/>',flat:true})">STRONG</a>
          <a onclick="this.sintView.editor.domManipulation.applyCommand(this.sintView.editor.domManipulation.htmlContainer,{string:'<em/>',flat:true})">italic</a>
          <a onclick="this.sintView.editor.domManipulation.insertFeObject('Container')">insert Container</a>
          <a onclick="this.sintView.editor.domManipulation.insertFeObject('Image')">insert Image</a>
          <a onclick="this.sintView.editor.domManipulation.insertFeObject('ImageDin')">insert ImageDin</a>
        </div>
        <div class="advEditorOverlayerAndBody">
          <div class="advEditorOverlayer">${
            this.editor.selectedFeObject ?
            `
            <div class="advEditorOverlayerUi" style="width:${this.editor.selectedFeObject.dom.clientWidth}px;left:${relativeBoundingClientRect.left}px; bottom:${relativeBoundingClientRect.top}px">${this.editor.selectedFeObject.template.ui.call(this.editor.selectedFeObject)}</div>
            <div class="advEditorOverlayerBorder" style="height:${this.editor.selectedFeObject.dom.clientHeight}px;width:1px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder" style="height:${this.editor.selectedFeObject.dom.clientHeight}px;width:1px; left:${relativeBoundingClientRect.right}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder" style="height:1px;width:${this.editor.selectedFeObject.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder"  style="height:1px;width:${this.editor.selectedFeObject.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.bottom}px"></div>
            `
            : ``
          }
          </div><div class="advEditorBody" contenteditable="true">${
            this.param('contents')
          }</div>
        </div>
        <textarea class="advEditorContents">${this.param('contents')}</textarea>
        <textarea class="advEditorData">${JSON.stringify(this.param('data'))}</textarea>

      </div>`
    },
    init: function (params) {},
    defaultParams: { contents: () => () => '', trackid: 'advEditor'},
    domInit: function (dom) {
      this.log('domInit')
      this.advEditorBody = dom.querySelector('.advEditorBody')
      this.advEditorOverlayer = dom.querySelector('.advEditorOverlayer')
      this.advEditorBody.addEventListener('selectstart', () => {
        let listener = () => {
          this.editor.range = window.getSelection().getRangeAt(0)
          this.log('this.editor.range setted', this.editor.range)
          dom.removeEventListener('mouseup', listener)
          document.removeEventListener('mouseup', listener)
        }
        let documentListener = () => {
          dom.removeEventListener('mouseup', listener)
          document.removeEventListener('mouseup', listener)
        }
        dom.addEventListener('mouseup', listener)
        document.addEventListener('mouseup', documentListener)
      })
    },
    css: `
    [contenteditable='false'] { user-select: none; }
    [contenteditable='true'] { user-select: auto; }
    .advEditorOverlayerAndBody {
      position: relative;
    }
    .advEditorOverlayer {
      position: relative;
    }
    .advEditorOverlayerBorder {
      background-color: #000;
      min-width: 1px;
      min-height: 1px;
      position: absolute;
    }
    .advEditorOverlayerUi {
      background-color: #fff;
      position: absolute;
    }
    `
  }
}
