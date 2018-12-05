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
  advEditor: {
    name: 'advEditor',
    render: function (params) {
      return `<div class="advEditor">
        <div class="advEditorBody" contenteditable="true">${
          params.contents
        }</div><div class="advEditorOverlayer"></div>
        <textarea class="advEditorContents">${this.param('contents')}</textarea>
        <textarea class="advEditorData">${JSON.stringify(this.param('data'))}</textarea>
        <div onclick="this.parentNode.sintView.applyCommand(this.parentNode.sintView.htmlContainer,{string:'<STRONG/>',flat:true})">STRONG</div>
        <div onclick="this.parentNode.sintView.applyCommand(this.parentNode.sintView.htmlContainer,{string:'<em/>',flat:true})">italic</div>
        <div onclick="this.parentNode.sintView.insertFeObject('image')">insert Image</div>
        <div onclick="this.parentNode.sintView.insertFeObject('imageDin')">insert ImageDin</div>
      </div>`
    },
    init: function (params) {
      this.editor = this
      this.selectedOFeObject = null
      this.applyCommand = function (command, params) {
        var contents = this.range.extractContents()
        var p = command(contents, params)
        this.log('applyCommand p', contents, contents.innerHTML, params, p)
        if (p) {
          this.range.deleteContents()
          this.range.insertNode(p)
        } else {
          this.range.insertNode(contents)
        }
        this.param('contents', this.editor.advEditorBody.innerHTML)
        // this.updateHtml()
      }
      this.insertFeObject = function (templateName) {
        var template = templates[templateName]
        var feObj = new FeObject(template, {}, {}, this, feObj => {
          if (feObj.contents) {
            feObj.contents.appendChild(this.range.extractContents())
          }
          this.range.insertNode(feObj.dom)
          this.updateHtml()
        })
      }
      this.testFunc = function () {
        window.console.log('test')
      }
      this.selectFeObject = function () {
        if (this.selectedObject && this.selectedObject.deselect) {
          this.selectedObject.deselect()
        }
        this.selectedOFeObject = this
      }
      this.deselectFeObject = function () {
        this.selectedObject.deselect()
        this.selectedOFeObject = null
      }
      this.createUi = function () {
        if (this.ui) return false
        var newUi = this.viewRender('advEditorUi', {}, true)
        this.log('newUi', newUi)
        this.editor.advEditorOverlayer.appendChild(newUi)
        newUi.setAttribute('FeObject', this.params.id)
        if (!this.uiBorders) {
          var border = document.createElement('border')
          this.uiBorders = [
            this.editor.advEditorOverlayer.appendChild(border.cloneNode()),
            this.editor.advEditorOverlayer.appendChild(border.cloneNode()),
            this.editor.advEditorOverlayer.appendChild(border.cloneNode()),
            this.editor.advEditorOverlayer.appendChild(border.cloneNode())
          ]
        }
        this.ui = newUi
      }
      this.relativePosition = function () {
        var parentPos = parent.getBoundingClientRect()
        var childrenPos = node.getBoundingClientRect()
        var relativePos = {
          top: childrenPos.top - parentPos.top,
          right: childrenPos.right - parentPos.right,
          bottom: childrenPos.bottom - parentPos.bottom,
          left: childrenPos.left - parentPos.left
        }
        return relativePos
      }
      this.updateUi = function () {
        var rel = this.relativePosition(
          this.dom,
          this.editor.advEditorOverlayer
        )
        this.ui.style.left = rel.left + 'px'
        this.ui.style.top = rel.top - this.ui.clientHeight + 'px'
        // TOP
        this.uiBorders[0].style.top = rel.top + 'px'
        this.uiBorders[0].style.left = rel.left + 'px'
        this.uiBorders[0].style.width = this.dom.clientWidth + 'px'
        // RIGHT
        this.uiBorders[1].style.top = rel.top + 'px'
        this.uiBorders[1].style.right = rel.right + 'px'
        this.uiBorders[1].style.height = this.dom.clientHeight + 'px'
        // BOTTOM
        this.uiBorders[2].style.top = rel.top + this.dom.clientHeight + 'px'
        this.uiBorders[2].style.left = rel.left + 'px'
        this.uiBorders[2].style.width = this.dom.clientWidth + 'px'
        // LEFT
        this.uiBorders[3].style.top = rel.top + 'px'
        this.uiBorders[3].style.left = rel.left + 'px'
        this.uiBorders[3].style.height = this.dom.clientHeight + 'px'
      }
      this.showUi = function () {
        this.ui.style.display = 'block'
        this.uiBorders[0].style.display = 'block'
        this.uiBorders[1].style.display = 'block'
        this.uiBorders[2].style.display = 'block'
        this.uiBorders[3].style.display = 'block'
      }
      this.hideUi = function () {
        this.ui.style.display = 'none'
        this.uiBorders[0].style.display = 'none'
        this.uiBorders[1].style.display = 'none'
        this.uiBorders[2].style.display = 'none'
        this.uiBorders[3].style.display = 'none'
      }
      this.htmlContainer = function (
        contents,
        params = { string: '<p/>', flat: false }
      ) {
        var dom = document.createElement('div')
        dom.innerHTML = params.string
        var element = dom.childNodes[0]
        window.console.log('htmlContainer', dom, element)
        element.appendChild(contents)
        return element
      }
    },
    defaultParams: { contents: () => () => '', trackid: 'advEditor', data: {} },
    click: function () {
      window.console.log('CLICK', this)
      this.editor.selectFeObject(this)
      this.updateUi()
      this.showUi()
    },
    domInit: function (dom) {
      this.log('domInit')
      this.editor.advEditorBody = dom.querySelector('.advEditorBody')
      this.editor.advEditorOverlayer = dom.querySelector('.advEditorOverlayer')
      this.editor.advEditorBody.addEventListener('click', () => this.click())
      this.editor.advEditorBody.addEventListener('selectstart', () => {
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
      this.createUi()
      this.hideUi()
    },
    css: `
    [contenteditable='false'] { user-select: none; }
    [contenteditable='true'] { user-select: auto; }
    .advEditorOverlayer {
      position: relative;
    }
    .advEditorOverlayer border {
      background-color: #000;
      min-width: 1px;
      min-height: 1px;
      position: absolute;
    }
    .advEditorOverlayer ui {
      background-color: #fff;
      position: absolute;
    }
    `
  }
}
