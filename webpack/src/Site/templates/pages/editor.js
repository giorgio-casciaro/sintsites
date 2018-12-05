import AdvHtmlEditor from 'AdvHtmlEditor/AdvHtmlEditor.class'

// -------------------------------------

var page = {
  title: 'page title',
  feObjs: {
    AdvHtmlEditor: {
      feobjid: 'advEditor',
      contents: '<p>page contents${await this.feObjRender(\'testContainer\')}</p>'
    },
    testContainer: {
      feObjType: 'Container',
      feobjid: 'testContainer',
      contents: '<p>page contents</p>',
      params: {}
    },
    testImg: {
      feObjType: 'Image',
      feobjid: 'testImg',
      params: {
        src: 'test.png',
        title: 'test.png',
        src: 'test.png'
      }
    }
  }
}
var publicClasses = {
  title: 'page title',
  feObjs: {
    AdvHtmlEditor: {
      feobjid: 'advEditor',
      contents: '<p>page contents${await this.feObjRender(\'testContainer\')}</p>'
    },
    testContainer: {
      feObjType: 'Container',
      feobjid: 'testContainer',
      contents: '<p>page contents</p>',
      params: {}
    },
    testImg: {
      feObjType: 'Image',
      feobjid: 'testImg',
      params: {
        src: 'test.png',
        title: 'test.png',
        src: 'test.png'
      }
    }
  }
}
var privateClasses = {
  title: 'page title',
  feObjs: {
    AdvHtmlEditor: {
      feobjid: 'advEditor',
      contents: '<p>page contents${await this.feObjRender(\'testContainer\')}</p>'
    },
    testContainer: {
      feObjType: 'Container',
      feobjid: 'testContainer',
      contents: '<p>page contents</p>',
      params: {}
    },
    testImg: {
      feObjType: 'Image',
      feobjid: 'testImg',
      params: {
        src: 'test.png',
        title: 'test.png',
        src: 'test.png'
      }
    }
  }
}

var advEditor = new AdvHtmlEditor(page.feObjs)

export default {
  name: 'pages/editor',
  render: async function (params) {
    return `<div>page 1
    ${await this.viewRenderByView(advEditor.body)}
    </div>`
  },
  defaultParams: { }
}
