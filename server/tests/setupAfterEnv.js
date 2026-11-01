// Each test file gets its own database; collections are emptied after every test.
const mongoose = require('mongoose');
const models = require('../models');

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  const dbName = `spm_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName });
  await Promise.all(Object.values(models).map((M) => M.createCollection().then(() => M.createIndexes())));
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(Object.values(models).map((M) => M.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
