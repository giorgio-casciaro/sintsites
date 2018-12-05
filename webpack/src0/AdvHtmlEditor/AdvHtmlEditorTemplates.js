export default {
  advEditorUi: {
    name: 'contents',
    render: async function (params) {
      return `<div>UI</div>`
    },
    defaultParams: { }
  },
  advEditorBody: {
    name: 'advEditorBody',
    render: async function (params) {
      if (this.editor.selectedFeObj) {
        var selectedFeObjRect = this.editor.selectedFeObj.body.dom.getBoundingClientRect()
        var advEditorBodyRect = this.advEditorBody.getBoundingClientRect()
        // this.log('selectedFeObjRect', selectedFeObjRect)
        // this.log('advEditorBodyRect', advEditorBodyRect)
        var relativeBoundingClientRect = {
          left: selectedFeObjRect.left - advEditorBodyRect.left,
          top: selectedFeObjRect.top - advEditorBodyRect.top,
          right: selectedFeObjRect.right - advEditorBodyRect.left,
          bottom: selectedFeObjRect.bottom - advEditorBodyRect.top
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
            this.editor.selectedFeObj ?
            `
            <div class="advEditorOverlayerUi" style="width:${this.editor.selectedFeObj.body.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top - 20}px">${await this.viewRenderByView(this.editor.selectedFeObj.ui)}</div>
            <div class="advEditorOverlayerBorder" style="height:${this.editor.selectedFeObj.body.dom.clientHeight}px;width:1px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder" style="height:${this.editor.selectedFeObj.body.dom.clientHeight}px;width:1px; left:${relativeBoundingClientRect.right}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder" style="height:1px;width:${this.editor.selectedFeObj.body.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.top}px"></div>
            <div class="advEditorOverlayerBorder"  style="height:1px;width:${this.editor.selectedFeObj.body.dom.clientWidth}px; left:${relativeBoundingClientRect.left}px; top:${relativeBoundingClientRect.bottom}px"></div>
            `
            : ``
          }
          </div><div class="advEditorBody" contenteditable="true">${
            await this.param('contents').call(this)
          }</div>
        </div>
        <div class="advEditorData">
        <textarea class="advEditorData">${JSON.stringify(this.param('feObjsData'))}</textarea>
        ${
          this.editor.selectedFeObj ?
          `<div class="advEditorOverlayerPanel" >${this.editor.selectedFeObj.panel ? await this.viewRenderByView(this.editor.selectedFeObj.panel) : ''}</div>
          `
          : ``
          }
        </div>

      </div>`
    },
    init: function (params) {},
    defaultParams: { trackid: 'advEditor'},
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
