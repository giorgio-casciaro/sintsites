var path = require('path')
var fs = require('fs')
module.exports = {
  service: {
    serviceName: process.env.serviceName || 'schema'
  },
  schemaHost: process.env.schemaHost || 'http://127.0.0.1:10000',
  confirmEmailUrl: process.env.confirmEmailUrl || 'http://127.0.0.1:10080/#/confirmEmailUrl',
  sendEmails: process.env.sendEmails || true,
  mailFrom: process.env.mailFrom || 'notifications@civilconnect.it',
  uploadPath: process.env.uploadPath || '/upload/',
  smtp: process.env.smtpConfigJson ? JSON.parse(process.env.smtpConfigJson) : {
    host: '127.0.0.1',
    port: 1025,
    secure: false,
    debug: true
  },
  jwt: {
    // 'passphrase': process.env.jwtPassphrase || 'CJhbGciOiJIUzI1NiJ9eyJ0eXAiOiJKV1QiL',
    'path': path.join(__dirname, './permissions/'),
    'privateCert': process.env.jwtPrivateCert || fs.readFileSync(path.join(__dirname, './server.key')),
    'publicCert': process.env.jwtPublicCert || fs.readFileSync(path.join(__dirname, './server.cert'))
  },
  couchbase: {
    url: process.env.couchbaseHosts || 'couchbase://couchbase',
    username: process.env.couchbaseUser || 'Administrator',
    password: process.env.couchbasePassword || 'password',
    bucket: process.env.couchbaseBucket || 'posts'
  },
  console: { error: process.env.consoleError || true, debug: process.env.consoleDebug || false, log: process.env.consoleLog || true, warn: process.env.consoleWarn || true }
}
