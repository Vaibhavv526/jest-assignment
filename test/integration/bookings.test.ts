import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import Booking from '../../models/Booking';
import { setupTestDb } from '../test-utils/setupTestDb';
import { resetDb } from '../test-utils/db';
import { seedTestDb, SeedData } from '../test-utils/seed';
import { registerAndLogin, bearer } from '../test-utils/authHelper';

describe('Bookings Integration Tests (POST /api/bookings & POST /api/bookings/:bookingId/cancel)', () => {
  setupTestDb();

  let seedData: SeedData;

  beforeEach(async () => {
    await resetDb();
    seedData = await seedTestDb();
  });

  describe('POST /api/bookings - Create Booking', () => {
    it('should create a booking successfully and return 201', async () => {
      const customer = await registerAndLogin(app);

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: seedData.service30._id.toString(),
          date: '2026-11-01',
          slotTime: '10:00'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'Booking created successfully');
      expect(res.body).toHaveProperty('booking');
      expect(res.body.booking.status).toBe('booked');
      expect(res.body.booking.startTime).toBe('10:00');
      expect(res.body.booking.endTime).toBe('10:30');
      expect(res.body.booking.customerId).toBe(customer.userId);

      // Verify in DB
      const dbBooking = await Booking.findById(res.body.booking._id);
      expect(dbBooking).not.toBeNull();
      expect(dbBooking?.status).toBe('booked');
    });

    it('should return 400 when attempting to book a slot that is already booked', async () => {
      const customer1 = await registerAndLogin(app);
      const customer2 = await registerAndLogin(app);

      // First booking
      await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer1.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: seedData.service30._id.toString(),
          date: '2026-11-01',
          slotTime: '10:00'
        });

      // Second booking attempt for same stylist and time
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer2.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: seedData.service30._id.toString(),
          date: '2026-11-01',
          slotTime: '10:00'
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Time slot is no longer available' });
    });

    it('should return 400 when date is missing', async () => {
      const customer = await registerAndLogin(app);

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: seedData.service30._id.toString(),
          slotTime: '10:00'
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'date is required' });
    });

    it('should return 404 when service is not found', async () => {
      const customer = await registerAndLogin(app);
      const randomServiceId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: randomServiceId.toString(),
          date: '2026-11-01',
          slotTime: '10:00'
        });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Service not found' });
    });

    // DEFECT: Missing slotTime causes TypeError: Cannot read properties of undefined (reading 'split') -> 500
    it.failing('should return 400 Bad Request when slotTime is missing', async () => {
      const customer = await registerAndLogin(app);

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: seedData.service30._id.toString(),
          date: '2026-11-01'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    // DEFECT: Invalid serviceId format triggers Mongoose CastError -> 500 instead of 400/404
    it.failing('should return 400 or 404 when serviceId is an invalid ObjectId format', async () => {
      const customer = await registerAndLogin(app);

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: 'invalid-service-id',
          date: '2026-11-01',
          slotTime: '10:00'
        });

      expect([400, 404]).toContain(res.status);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/bookings/:bookingId/cancel - Cancel Booking', () => {
    it('should allow customer to cancel their own booking and return 200', async () => {
      const customer = await registerAndLogin(app);

      // Create booking
      const bookRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: seedData.service30._id.toString(),
          date: '2026-11-01',
          slotTime: '10:00'
        });

      const bookingId = bookRes.body.booking._id;

      // Cancel booking
      const cancelRes = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', bearer(customer.token));

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body).toEqual({ message: 'Booking cancelled successfully' });

      // Verify in DB
      const dbBooking = await Booking.findById(bookingId);
      expect(dbBooking?.status).toBe('cancelled');
    });

    it('should return 400 if booking is already cancelled', async () => {
      const customer = await registerAndLogin(app);

      const bookRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: seedData.service30._id.toString(),
          date: '2026-11-01',
          slotTime: '10:00'
        });

      const bookingId = bookRes.body.booking._id;

      // First cancel
      await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', bearer(customer.token));

      // Second cancel attempt
      const res = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', bearer(customer.token));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Booking is already cancelled' });
    });

    it('should return 404 if booking is not found', async () => {
      const customer = await registerAndLogin(app);
      const randomBookingId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/bookings/${randomBookingId}/cancel`)
        .set('Authorization', bearer(customer.token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Booking not found' });
    });

    it('should return 403 Forbidden when a customer tries to cancel someone elses booking', async () => {
      const customerA = await registerAndLogin(app);
      const customerB = await registerAndLogin(app);

      // Customer A creates booking
      const bookRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customerA.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: seedData.service30._id.toString(),
          date: '2026-11-01',
          slotTime: '10:00'
        });

      const bookingId = bookRes.body.booking._id;

      // Customer B attempts to cancel Customer A's booking
      const res = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', bearer(customerB.token));

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Not authorized to cancel this booking' });
    });

    it('should allow admin to cancel any customers booking', async () => {
      const customer = await registerAndLogin(app);

      // Customer creates booking
      const bookRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', bearer(customer.token))
        .send({
          salonId: seedData.salon._id.toString(),
          stylistId: seedData.stylist1._id.toString(),
          serviceId: seedData.service30._id.toString(),
          date: '2026-11-01',
          slotTime: '10:00'
        });

      const bookingId = bookRes.body.booking._id;

      // Admin logs in
      const adminLoginRes = await request(app)
        .post('/api/login')
        .send({
          email: seedData.admin.email,
          password: seedData.passwords.admin
        });
      const adminToken = adminLoginRes.body.token;

      // Admin cancels customer's booking
      const res = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', bearer(adminToken));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Booking cancelled successfully' });

      // Verify in DB
      const dbBooking = await Booking.findById(bookingId);
      expect(dbBooking?.status).toBe('cancelled');
    });

    // DEFECT: Invalid bookingId format triggers Mongoose CastError -> returns 500 instead of 400/404
    it.failing('should return 400 or 404 when bookingId is an invalid ObjectId format', async () => {
      const customer = await registerAndLogin(app);

      const res = await request(app)
        .post('/api/bookings/invalid-id-format/cancel')
        .set('Authorization', bearer(customer.token));

      expect([400, 404]).toContain(res.status);
      expect(res.body).toHaveProperty('error');
    });
  });
});
