
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
  advEditorBody: {
    name: 'advEditorBody',
    render: function (params) {
      if (this.editor.selectedFeObject) {
        var selectedFeObjectRect = this.editor.selectedFeObject.body.dom.getBoundingClientRect()
        var advEditorBodyRect = this.advEditorBody.getBoundingClientRect()
        // this.log('selectedFeObjectRect', selectedFeObjectRect)
        // this.log('advEditorBodyRect', advEditorBodyRect)
        var relativeBoundingClientRect = {
          left: selectedFeObjectRect.left - advEditorBodyRect.left,
          top: selectedFeObjectRect.top - advEditorBodyRect.top,
          right: selectedFeObjectRect.right - advEditorBodyRect.left,
          bottom: selectedFeObjectRect.bottom - advEditorBodyRect.top
        }
      }
      return `<div class="advEditor">
        <div class="advEditorUi" >
          <a onclick="this.closest('[trackid]').sintView.editor.contentsModHtmlContainer({string:'<STRONG/>',flat:true})">STRONG</a>
          <a onclick="this.closest('[trackid]').sintView.editor.contentsModHtmlContainer({string:'<em/>',flat:true})">italic</a>
          <a onclick="this.closest('[trackid]').sintView.editor.contentsModInsertFeObject('Container')">insert Container</a>
          <a onclick="this.closest('[trackid]').sintView.editor.contentsModInsertFeObject('Image')">insert Image</a>
          <a onclick="this.closest('[trackid]').sintView.editor.contentsModInsertFeObject('ImageDin')">insert ImageDin</a>
        </div>
        <div class="advEditorOverlayerAndBody">
          <div class="advEditorOverlayer">${
            this.editor.selectedFeObject ?
            `
            <div class="advEditorOverlayerUi" style="width:${this.editor.selectedFeObject.body.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top - 20}px">${this.viewRenderByView(this.editor.selectedFeObject.ui)}</div>
            <div class="advEditorOverlayerBorder" style="height:${this.editor.selectedFeObject.body.dom.clientHeight}px;width:1px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder" style="height:${this.editor.selectedFeObject.body.dom.clientHeight}px;width:1px; left:${relativeBoundingClientRect.right}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder" style="height:1px;width:${this.editor.selectedFeObject.body.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder"  style="height:1px;width:${this.editor.selectedFeObject.body.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.bottom}px"></div>
            `
            : ``
          }
          </div><div class="advEditorBody" contenteditable="true">${
            this.param('contents')()
          }</div>
        </div>
        <div class="advEditorData">
        <textarea class="advEditorData">${JSON.stringify(this.param('feObjsData'))}</textarea>
        ${
          this.editor.selectedFeObject ?
          `<div class="advEditorOverlayerPanel" >${this.editor.selectedFeObject.panel ? this.viewRenderByView(this.editor.selectedFeObject.panel) : ''}</div>
          `
          : ``
          }
        </div>

      </div>`
    },
    init: function (params) {},
    defaultParams: { contents: () => () => '', trackid: 'advEditor'},
    domInit: function (dom) {
      // this.log('domInit')
      this.advEditorBody = dom.querySelector('.advEditorBody')

      this.editor.range = new Range()
      this.editor.range.setStart(this.advEditorBody, 0)
      this.editor.range.setEnd(this.advEditorBody, 0)

      this.advEditorOverlayer = dom.querySelector('.advEditorOverlayer')
      this.advEditorBody.addEventListener('selectstart', () => {
        let listener = () => {
          this.editor.range = window.getSelection().getRangeAt(0)
          // this.log('this.editor.range setted', this.editor.range)
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
      z-index:1;
    }
    .advEditorOverlayerUi {
      background-color: #fff;
      position: absolute;
      z-index:1;
    }
    .advEditorBody {
       z-index:0; position: relative; background:#fff; border:1px solid #ccc; padding:2rem
    }
    .advEditorOverlayerPanel:empty{ display:none }
    .advEditorOverlayerPanel{ z-index:2; position: absolute; top:25vh;left:25vw;width:50vw;height:50vh; background:#eee; border:1px solid #ccc; padding:2rem }
    `
  }
}
