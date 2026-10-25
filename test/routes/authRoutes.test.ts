import request from 'supertest';
import app from '../../app';

describe('authRoutes Route Mounting', () => {
  it('should mount POST /api/register and respond without 404', async () => {
    const res = await request(app).post('/api/register').send({});
    expect(res.status).not.toBe(404);
  });

  it('should mount POST /api/login and respond without 404', async () => {
    const res = await request(app).post('/api/login').send({});
    expect(res.status).not.toBe(404);
  });
});
