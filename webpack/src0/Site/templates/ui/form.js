export default {
  name: 'ui/form',
  render: async function (params) {
    return `
    <form>
    ${this.params.contents.call ? await this.param('contents').call(this) : this.param('contents')}
    <input type="submit" value="submit" /><input type="reset" value="reset" />
    </form>
    `
  },
  init: function () {
    // if (!this.params.id) this.params.id = Math.random()
    if (!this.params.trackid) this.params.trackid = Math.random()
  },
  domInit: function (dom) {
    dom.addEventListener('submit', (event) => {
      event.preventDefault()
      var values = {}
      this.dom.querySelectorAll('[input_value][input_name]').forEach((input) => values[input.getAttribute('input_name')] = JSON.parse(input.getAttribute('input_value')))
      this.isValid = !this.dom.querySelector('[input_value][valid="false"]')
      this.values = values
      this.params.onSubmit.call(this, event)
    })
  },
  defaultParams: {
    trackid: null,
    contents: null,
    onSubmit: () => function (event) {}
  }
}
// await this.param('contents').call(this)
