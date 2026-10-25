import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import Booking from '../../models/Booking';
import { setupTestDb } from '../test-utils/setupTestDb';
import { resetDb } from '../test-utils/db';
import { seedTestDb, SeedData } from '../test-utils/seed';

describe('Salons Integration Tests (GET /api/salons/:salonId/available-slots)', () => {
  setupTestDb();

  let seedData: SeedData;

  beforeEach(async () => {
    await resetDb();
    seedData = await seedTestDb();
  });

  it('should return available slots for a 30-minute service across all available stylists', async () => {
    const res = await request(app)
      .get(`/api/salons/${seedData.salon._id}/available-slots`)
      .query({
        date: '2026-11-01',
        serviceId: seedData.service30._id.toString()
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('date', '2026-11-01');
    expect(res.body).toHaveProperty('service', seedData.service30.name);
    expect(res.body).toHaveProperty('duration', 30);
    expect(Array.isArray(res.body.availableSlots)).toBe(true);

    // Salon is open 09:00 - 18:00 (9 hours = 18 intervals of 30 mins)
    // 2 stylists = 36 total slots
    expect(res.body.availableSlots.length).toBe(36);

    const firstSlot = res.body.availableSlots[0];
    expect(firstSlot).toHaveProperty('time', '09:00');
    expect(firstSlot).toHaveProperty('stylistId');
    expect(firstSlot).toHaveProperty('stylistName');

    const lastSlot = res.body.availableSlots[res.body.availableSlots.length - 1];
    expect(lastSlot.time).toBe('17:30');
  });

  it('should return available slots for a 60-minute service', async () => {
    const res = await request(app)
      .get(`/api/salons/${seedData.salon._id}/available-slots`)
      .query({
        date: '2026-11-01',
        serviceId: seedData.service60._id.toString()
      });

    expect(res.status).toBe(200);
    expect(res.body.duration).toBe(60);

    // For 60m service: openMins (540) to closeMins (1080), currentMins + 60 <= 1080
    // Last valid start time is 17:00
    const slotTimes = res.body.availableSlots.map((s: any) => s.time);
    expect(slotTimes).toContain('09:00');
    expect(slotTimes).toContain('17:00');
    expect(slotTimes).not.toContain('17:30'); // 17:30 + 60m = 18:30 > 18:00
  });

  it('should exclude slots where a stylist is already booked', async () => {
    // Create an existing booking for stylist 1 at 10:00 - 10:30
    await Booking.create({
      salonId: seedData.salon._id,
      stylistId: seedData.stylist1._id,
      customerId: seedData.admin._id,
      serviceId: seedData.service30._id,
      date: '2026-11-01',
      startTime: '10:00',
      endTime: '10:30',
      status: 'booked'
    });

    const res = await request(app)
      .get(`/api/salons/${seedData.salon._id}/available-slots`)
      .query({
        date: '2026-11-01',
        serviceId: seedData.service30._id.toString()
      });

    expect(res.status).toBe(200);

    // At 10:00, only stylist 2 should be available
    const tenAmSlots = res.body.availableSlots.filter((s: any) => s.time === '10:00');
    expect(tenAmSlots.length).toBe(1);
    expect(tenAmSlots[0].stylistId.toString()).toBe(seedData.stylist2._id.toString());
  });

  it('should return 400 when date query parameter is missing', async () => {
    const res = await request(app)
      .get(`/api/salons/${seedData.salon._id}/available-slots`)
      .query({ serviceId: seedData.service30._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'date and serviceId are required' });
  });

  it('should return 400 when serviceId query parameter is missing', async () => {
    const res = await request(app)
      .get(`/api/salons/${seedData.salon._id}/available-slots`)
      .query({ date: '2026-11-01' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'date and serviceId are required' });
  });

  it('should return 404 when salon is not found', async () => {
    const randomSalonId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/salons/${randomSalonId}/available-slots`)
      .query({
        date: '2026-11-01',
        serviceId: seedData.service30._id.toString()
      });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Salon or Service not found' });
  });

  it('should return 404 when service is not found', async () => {
    const randomServiceId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/salons/${seedData.salon._id}/available-slots`)
      .query({
        date: '2026-11-01',
        serviceId: randomServiceId.toString()
      });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Salon or Service not found' });
  });

  // DEFECT: Invalid salonId ObjectId causes Mongoose CastError -> returns 500 instead of 400/404
  it.failing('should return 400 or 404 when salonId is an invalid ObjectId format', async () => {
    const res = await request(app)
      .get('/api/salons/invalid-object-id/available-slots')
      .query({
        date: '2026-11-01',
        serviceId: seedData.service30._id.toString()
      });

    // Desired API behavior is client error (400 or 404), but controller currently returns 500
    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  // DEFECT: Invalid serviceId ObjectId causes Mongoose CastError -> returns 500 instead of 400/404
  it.failing('should return 400 or 404 when serviceId is an invalid ObjectId format', async () => {
    const res = await request(app)
      .get(`/api/salons/${seedData.salon._id}/available-slots`)
      .query({
        date: '2026-11-01',
        serviceId: 'not-a-valid-service-id'
      });

    // Desired API behavior is client error (400 or 404), but controller currently returns 500
    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });
});
