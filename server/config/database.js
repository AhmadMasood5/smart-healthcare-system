const dns = require('dns');
const mongoose = require('mongoose');

async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy server/.env.example to server/.env and provide a connection string.');
  }
  // Optional: some machines' local DNS proxies refuse the SRV lookups that mongodb+srv:// URIs need.
  if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));
  }
  await mongoose.connect(uri);
  await assertTransactionSupport();
  return mongoose.connection;
}

// Change-request approval relies on multi-document transactions, which
// MongoDB only supports on replica sets / sharded clusters (e.g. Atlas).
async function assertTransactionSupport() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error(
      'The configured MongoDB deployment is a standalone server and does not support transactions. ' +
        'Use MongoDB Atlas or a replica set (see README: "MongoDB configuration").'
    );
  }
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
