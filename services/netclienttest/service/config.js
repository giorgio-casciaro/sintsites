module.exports = {
  http: {
    'url': `0.0.0.0:${process.env.netHostHttpPublicPort || '80'}`,
    'cors': process.env.netCors || process.env.netHost || '127.0.0.1'
  },
  zeromq: {
    'url': `tcp://0.0.0.0:${process.env.netHostZeromqPort || '81'}`
  }
}
