const request = require('supertest');
const appServer = require('../../testUtils/appServer');

describe('Links', () => {
  let server;
  beforeAll(async () => { server = await appServer.startTestServer(); });
  afterAll(async () => { await appServer.stopTestServer(); });

  test('GET /api/links returns 200', async () => {
    const res = await request(server).get('/api/links');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
