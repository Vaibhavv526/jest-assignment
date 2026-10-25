import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import User from '../../models/User';
import { setupTestDb } from '../test-utils/setupTestDb';
import { resetDb } from '../test-utils/db';
import { seedTestDb, SeedData } from '../test-utils/seed';
import { uniqueUser, bearer } from '../test-utils/authHelper';

describe('Auth Integration Tests (Supertest & Real MongoDB)', () => {
  setupTestDb();

  let seedData: SeedData;

  beforeEach(async () => {
    await resetDb();
    seedData = await seedTestDb();
  });

  describe('POST /api/register', () => {
    it('should register a new customer and return 201', async () => {
      const newUser = uniqueUser('reg');

      const res = await request(app)
        .post('/api/register')
        .send(newUser);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ message: 'User registered successfully' });

      // Verify user is in MongoDB
      const savedUser = await User.findOne({ email: newUser.email });
      expect(savedUser).not.toBeNull();
      expect(savedUser?.name).toBe(newUser.name);
      expect(savedUser?.role).toBe('customer');
    });

    it('should return 400 if email is already in use', async () => {
      const existingUser = uniqueUser('dup');

      // First registration
      await request(app)
        .post('/api/register')
        .send(existingUser);

      // Duplicate registration attempt
      const res = await request(app)
        .post('/api/register')
        .send(existingUser);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Email already in use' });
    });

    // DEFECT: Missing password causes bcrypt.hash(undefined) -> 500 Server error instead of 400 Bad Request
    it.failing('should return 400 Bad Request when password is missing from registration payload', async () => {
      const invalidUser = {
        name: 'No Password User',
        email: 'nopass@test.com'
      };

      const res = await request(app)
        .post('/api/register')
        .send(invalidUser);

      // Expected clean validation error (400)
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/login', () => {
    it('should return 200 with JWT token, role, and userId on valid credentials', async () => {
      const credentials = uniqueUser('login');

      await request(app)
        .post('/api/register')
        .send(credentials);

      const res = await request(app)
        .post('/api/login')
        .send({
          email: credentials.email,
          password: credentials.password
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.role).toBe('customer');
      expect(res.body).toHaveProperty('userId');

      // Validate JWT token integrity
      const decoded = jwt.verify(
        res.body.token,
        process.env.JWT_SECRET || 'supersecretjwtkey_12345'
      ) as { userId: string; role: string };
      expect(decoded.userId).toBe(res.body.userId);
      expect(decoded.role).toBe('customer');
    });

    it('should return 400 for incorrect password', async () => {
      const credentials = uniqueUser('wrongpass');

      await request(app)
        .post('/api/register')
        .send(credentials);

      const res = await request(app)
        .post('/api/login')
        .send({
          email: credentials.email,
          password: 'wrong_password_123'
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid credentials' });
    });

    it('should return 400 for unregistered email', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'unregistered_user@test.com',
          password: 'somepassword'
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid credentials' });
    });

    // DEFECT: Missing password causes bcrypt.compare(undefined) -> 500 Server error instead of 400 Bad Request
    it.failing('should return 400 Bad Request when password is missing from login payload', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ email: 'admin@salon.test' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Authentication & Authorization Middleware Edge Cases', () => {
    const testProtectedEndpoint = async (authHeader?: string) => {
      const req = request(app)
        .post('/api/bookings')
        .send({
          salonId: seedData.salon._id,
          stylistId: seedData.stylist1._id,
          serviceId: seedData.service30._id,
          date: '2026-11-01',
          slotTime: '10:00'
        });

      if (authHeader !== undefined) {
        req.set('Authorization', authHeader);
      }
      return req;
    };

    it('should return 401 Authentication required when no Authorization header is provided', async () => {
      const res = await testProtectedEndpoint(undefined);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required' });
    });

    it('should return 401 Invalid token when Authorization token is malformed', async () => {
      const res = await testProtectedEndpoint('Bearer not-a-valid-jwt-token');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid token' });
    });

    it('should return 401 Invalid token when token is expired', async () => {
      const expiredToken = jwt.sign(
        { userId: seedData.admin._id, role: 'admin' },
        process.env.JWT_SECRET || 'supersecretjwtkey_12345',
        { expiresIn: '-1s' } // Expired 1 second ago
      );

      const res = await testProtectedEndpoint(bearer(expiredToken));

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid token' });
    });

    it('should return 401 Invalid token when token was signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { userId: seedData.admin._id, role: 'admin' },
        'this_is_the_wrong_secret_key_99999',
        { expiresIn: '1h' }
      );

      const res = await testProtectedEndpoint(bearer(wrongSecretToken));

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid token' });
    });

    it('should return 401 User not found when valid token belongs to a deleted user', async () => {
      const ephemeralUser = uniqueUser('ephemeral');
      const regRes = await request(app).post('/api/register').send(ephemeralUser);
      expect(regRes.status).toBe(201);

      const loginRes = await request(app).post('/api/login').send({
        email: ephemeralUser.email,
        password: ephemeralUser.password
      });
      const validToken = loginRes.body.token;

      // Delete the user from the database
      await User.deleteOne({ email: ephemeralUser.email });

      const res = await testProtectedEndpoint(bearer(validToken));

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'User not found' });
    });
  });
});
