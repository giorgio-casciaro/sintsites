const domManipulation = {
  applyCommand: function (command, params) {
    console.log('applyCommand this ', this, command, params)
    var contents = this.range.extractContents()
    var p = command(contents, params)
    this.log('applyCommand p', p)
    if (p) {
      this.range.deleteContents()
      this.range.insertNode(p)
    } else {
      this.range.insertNode(contents)
    }
    if (this.afterApplyCommand) this.afterApplyCommand(command, params, p, contents)

  // this.updateHtml()
  },
  htmlContainer: function (contents, params = { string: '<p/>', flat: false }) {
    var dom = document.createElement('div')
    dom.innerHTML = params.string
    var element = dom.childNodes[0]
    element.appendChild(contents)
    window.console.log('htmlContainer', dom, element)
    return element
  },
  insertFeObject: function (templateName) {
    var dom = document.createElement('div')
    dom.appendChild(this.range.extractContents())
    this.log('feObj dom.innerHTML', dom.innerHTML)
    var feobjid = Math.floor(Math.random() * 10000000000000000)
    this.domPlaceholders = false
    // var feObj = this.viewRender('feObj' + templateName, { contents: dom.innerHTML, feobjid }, true)
    var feObj = new SintView('feObj' + templateName, { contents: dom.innerHTML, feobjid }, this)
    feObj.editor = this.editor || this
    feObj.editor.feObjs[feobjid] = feObj
    feObj.editor.params.data[feobjid] = feObj.params
    feObj.editor.domUpdate('data')
    console.log(feObj)
    this.range.insertNode(feObj.renderDom())
    if (this.afterInsertFeObject) this.afterInsertFeObject(templateName)
  }
}

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
  advEditor: {
    name: 'advEditor',
    render: function (params) {
      if (this.selectedFeObject) {
        var selectedFeObjectRect = this.selectedFeObject.dom.getBoundingClientRect()
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
          <a onclick="this.sintView.domManipulation.applyCommand(this.sintView.domManipulation.htmlContainer,{string:'<STRONG/>',flat:true})">STRONG</a>
          <a onclick="this.sintView.domManipulation.applyCommand(this.sintView.domManipulation.htmlContainer,{string:'<em/>',flat:true})">italic</a>
          <a onclick="this.sintView.domManipulation.insertFeObject('Container')">insert Container</a>
          <a onclick="this.sintView.domManipulation.insertFeObject('Image')">insert Image</a>
          <a onclick="this.sintView.domManipulation.insertFeObject('ImageDin')">insert ImageDin</a>
        </div>
        <div class="advEditorOverlayerAndBody">
          <div class="advEditorOverlayer">${
            this.selectedFeObject ?
            `
            <div class="advEditorOverlayerUi" style="width:${this.selectedFeObject.dom.clientWidth}px;left:${relativeBoundingClientRect.left}px; bottom:${relativeBoundingClientRect.top}px">${this.selectedFeObject.template.ui.call(this.selectedFeObject)}</div>
            <div class="advEditorOverlayerBorder" style="height:${this.selectedFeObject.dom.clientHeight}px;width:1px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder" style="height:${this.selectedFeObject.dom.clientHeight}px;width:1px; left:${relativeBoundingClientRect.right}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder" style="height:1px;width:${this.selectedFeObject.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder"  style="height:1px;width:${this.selectedFeObject.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.bottom}px"></div>
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
    init: function (params) {
      this.editor = this
      this.feObjs = {}
      this.domManipulation = {}
      var _this = this
      for (let i in domManipulation) this.domManipulation[i] = function () { return domManipulation[i].apply(_this, arguments) }
      this.selectedFeObject = null
      this.selectFeObject = function (feObject) {
        if (this.selectedObject && this.selectedObject.deselect) this.selectedObject.deselect()
        this.selectedFeObject = feObject
        this.renderDom()
      }
      this.deselectFeObject = function () {
        this.selectedObject.deselect()
        this.selectedFeObject = null
        this.renderDom()
      }
      this.feObj = function (feobjid, feObj) {
        if (feObj) this.feObjs[feobjid] = feObj
        return this.feObjs[feobjid]
      }
      this.openPanel = function (feobjid, feObj) {

      }
      this.delete = function () {
        if (this.dom) { this.dom.parentNode.deleteChild(this.dom) }
        delete this.editor.feObjs[this.params.feobjid]
      }
      this.afterApplyCommand = () => this.param('contents', this.advEditorBody.innerHTML)
      this.afterInsertFeObject = () => this.param('contents', this.advEditorBody.innerHTML)
    },
    defaultParams: { contents: () => () => '', trackid: 'advEditor', data: {} },
    domInit: function (dom) {
      this.log('domInit')
      this.advEditorBody = dom.querySelector('.advEditorBody')
      this.advEditorOverlayer = dom.querySelector('.advEditorOverlayer')
      this.advEditorBody.addEventListener('selectstart', () => {
        let listener = () => {
          this.range = window.getSelection().getRangeAt(0)
          this.log('this.range setted', this.range)
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
