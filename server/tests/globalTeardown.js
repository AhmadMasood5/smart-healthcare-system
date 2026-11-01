module.exports = async () => {
  const replSet = globalThis.__MONGO_REPLSET__;
  if (!replSet) return;
  // On Windows the graceful "shutdown" command ends with ECONNRESET instead of "connection closed",
  // which mongodb-memory-server prints as a warning. It is expected during teardown, so hide only that.
  const warn = console.warn;
  console.warn = (err, ...rest) => {
    if (err && err.name === 'MongoNetworkError' && /ECONNRESET/.test(err.message)) return;
    warn(err, ...rest);
  };
  try {
    await replSet.stop();
  } finally {
    console.warn = warn;
  }
};
