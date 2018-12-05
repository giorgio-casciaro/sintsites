export default {
  name: 'ui/contents',
  render: async function (params) {
    return `${await this.param('contents').call(this)}`
  },
  defaultParams: { contents: () => () => '' }
}
