module.exports = {
  httpHost: process.env.httpHost || '0.0.0.0',
  httpPort: process.env.httpPort || 10000,
  couchbase: {
    url: process.env.couchbaseHosts || 'couchbase://couchbase',
    username: process.env.couchbaseUser || 'Administrator',
    password: process.env.couchbasePassword || 'password'
  }
}
