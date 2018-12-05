export default {
  name: 'ui/tabs',
  render: async function (params) {
    // this.log('this.param', this.param('activeTab'))

    // var tabsHtml = ''
    var tabsHeaderHtml = ''
    for (var i in this.param('tabs')) {
      let tab = this.params.tabs[i]
      if (parseInt(i) === this.param('activeTab')) this.activeTab = tab
      tabsHeaderHtml += `<div class="uiTabTitle"  ${parseInt(i) === this.param('activeTab') ? 'active="true"' : ''} title="${tab.description}"><a index="${i}">${tab.title}</a></div>`
      // tabsHtml += `<div class="uiTab" ${parseInt(i) === this.param('activeTab') ? 'active="true"' : ''}>` + await tab.contents.call(this) + `</div>`
    }
    return `
    <div class="${this.param('classes').join(' ')}">
    <div class="uiTabsTitles">${tabsHeaderHtml}</div>
    <div class="uiTabDescription">${this.activeTab.description}</div>
    <div class="uiTabBody ${this.param('tabClasses').join(' ')}">${this.activeTab.contents.call ? await this.activeTab.contents.call(this) : this.activeTab.contents}</div>
    </div>
    `
  },
  init: function () {
  },
  domInit: function (dom) {
    // this.log('domInitdomInitdomInitdomInitdomInitdomInitdomInitdomInitdomInitdomInitdomInit', dom.querySelector('.uiTabsTitles'))
    dom.querySelector('.uiTabsTitles').addEventListener('click', (event) => {
      this.param('activeTab', parseInt(event.srcElement.getAttribute('index')))
      // this.log('uiTabsTitles click', event.srcElement.getAttribute('index'), this.param('activeTab'))
    })
  },
  defaultParams: {
    trackid: null,
    tabs: [],
    classes: ['tabsContainer'],
    tabClasses: ['tabsTab'],
    activeTab: 0
  },
  css: `
  .uiTabsTitles{ display:flex}
  .uiTab{ display:none}
  .uiTab[active]{ display:block}
  .uiTabTitle[active]{  background:#666; color:#fff}
  `
}
// await this.param('contents').call(this)
