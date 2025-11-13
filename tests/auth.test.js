const request = require('supertest');
const mongoose = require('mongoose');
const appServer = require('../../testUtils/appServer');

describe('Auth', () => {
  let server;
  beforeAll(async () => {
    server = await appServer.startTestServer();
  });
  afterAll(async () => {
    await appServer.stopTestServer();
  });

  test('login fails with bad creds', async () => {
    const res = await request(server).post('/api/auth/login').send({ email: 'noone@example.com', password: 'bad' });
    expect(res.status).toBe(401);
  });
});
