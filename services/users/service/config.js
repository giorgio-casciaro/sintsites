var path = require('path')
var fs = require('fs')
module.exports = {
  serviceName: process.env.serviceName,
  smtp: process.env.smtpConfigJson ? JSON.parse(process.env.smtpConfigJson) : {
    host: '127.0.0.1',
    from: 'info@civilconnect.it',
    port: 1025,
    secure: false,
    debug: true
  },
  http: {
    'url': `${process.env.netHost || '0.0.0.0'}:${process.env.netHostHttpPublicPort || '80'}`,
    'cors': process.env.netCors || process.env.netHost || '127.0.0.1'
  },
  zeromq: {
    'url': `${process.env.netHostZeromq || 'tcp://0.0.0.0'}:${process.env.netHostZeromqPort || '81'}`
  },
  jwt: {
    'privateCert': process.env.jwtPrivateCert || fs.readFileSync(path.join(__dirname, './server.key')),
    'publicCert': process.env.jwtPublicCert || fs.readFileSync(path.join(__dirname, './server.cert'))
  },
  couchbase: {
    url: process.env.couchbaseHosts || 'couchbase://couchbase',
    username: process.env.couchbaseUser || 'Administrator',
    password: process.env.couchbasePassword || 'password',
    bucket: process.env.couchbaseBucket || 'users'
  }
  // console: { error: process.env.consoleError || true, debug: process.env.consoleDebug || false, log: process.env.consoleLog || true, warn: process.env.consoleWarn || true }
}
