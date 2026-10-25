import request from 'supertest';
import app from '../../app';
import Booking from '../../models/Booking';
import { setupTestDb } from '../test-utils/setupTestDb';
import { resetDb } from '../test-utils/db';
import { seedTestDb, SeedData } from '../test-utils/seed';
import { uniqueUser, bearer, registerAndLogin } from '../test-utils/authHelper';

describe('End-to-End (E2E) Flow Integration Tests', () => {
  setupTestDb();

  let seedData: SeedData;

  beforeEach(async () => {
    await resetDb();
    seedData = await seedTestDb();
  });

  it('Mandatory E2E Lifecycle: Register -> Login -> Available Slots -> Book -> Verify Slot Removed -> Cancel -> Verify Slot Restored -> Double Cancel returns 400', async () => {
    const bookingDate = '2026-12-01';
    const targetSlotTime = '09:30';
    const stylistId = seedData.stylist1._id.toString();
    const serviceId = seedData.service30._id.toString();
    const salonId = seedData.salon._id.toString();

    // 1. REGISTER
    const customerCredentials = uniqueUser('alice');
    const registerRes = await request(app)
      .post('/api/register')
      .send(customerCredentials);

    expect(registerRes.status).toBe(201);
    expect(registerRes.body).toEqual({ message: 'User registered successfully' });

    // 2. LOGIN
    const loginRes = await request(app)
      .post('/api/login')
      .send({
        email: customerCredentials.email,
        password: customerCredentials.password
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    expect(loginRes.body).toHaveProperty('userId');
    const customerToken = loginRes.body.token;
    const customerId = loginRes.body.userId;

    // 3. GET INITIAL AVAILABLE SLOTS
    const initialSlotsRes = await request(app)
      .get(`/api/salons/${salonId}/available-slots`)
      .query({
        date: bookingDate,
        serviceId
      });

    expect(initialSlotsRes.status).toBe(200);
    const hasInitialSlot = initialSlotsRes.body.availableSlots.some(
      (slot: any) => slot.time === targetSlotTime && slot.stylistId.toString() === stylistId
    );
    expect(hasInitialSlot).toBe(true);

    // 4. BOOK THE SLOT
    const bookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', bearer(customerToken))
      .send({
        salonId,
        stylistId,
        serviceId,
        date: bookingDate,
        slotTime: targetSlotTime
      });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body).toHaveProperty('message', 'Booking created successfully');
    expect(bookRes.body.booking).toHaveProperty('_id');
    expect(bookRes.body.booking.customerId).toBe(customerId);
    expect(bookRes.body.booking.status).toBe('booked');
    const bookingId = bookRes.body.booking._id;

    // 5. VERIFY SLOT IS GONE FROM AVAILABLE SLOTS
    const postBookingSlotsRes = await request(app)
      .get(`/api/salons/${salonId}/available-slots`)
      .query({
        date: bookingDate,
        serviceId
      });

    expect(postBookingSlotsRes.status).toBe(200);
    const isSlotStillAvailable = postBookingSlotsRes.body.availableSlots.some(
      (slot: any) => slot.time === targetSlotTime && slot.stylistId.toString() === stylistId
    );
    expect(isSlotStillAvailable).toBe(false);

    // 6. CANCEL THE BOOKING
    const cancelRes = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', bearer(customerToken));

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body).toEqual({ message: 'Booking cancelled successfully' });

    // Verify DB booking status
    const cancelledBooking = await Booking.findById(bookingId);
    expect(cancelledBooking?.status).toBe('cancelled');

    // 7. VERIFY SLOT IS BACK IN AVAILABLE SLOTS
    const postCancelSlotsRes = await request(app)
      .get(`/api/salons/${salonId}/available-slots`)
      .query({
        date: bookingDate,
        serviceId
      });

    expect(postCancelSlotsRes.status).toBe(200);
    const isSlotRestored = postCancelSlotsRes.body.availableSlots.some(
      (slot: any) => slot.time === targetSlotTime && slot.stylistId.toString() === stylistId
    );
    expect(isSlotRestored).toBe(true);

    // 8. CANCEL AGAIN RETURNS 400 (Booking is already cancelled)
    const doubleCancelRes = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', bearer(customerToken));

    expect(doubleCancelRes.status).toBe(400);
    expect(doubleCancelRes.body).toEqual({ error: 'Booking is already cancelled' });
  });

  it('Negative E2E: Another customer cannot cancel booking (403), but Admin can cancel it (200)', async () => {
    const bookingDate = '2026-12-02';
    const targetSlotTime = '14:00';
    const stylistId = seedData.stylist2._id.toString();
    const serviceId = seedData.service30._id.toString();
    const salonId = seedData.salon._id.toString();

    // 1. Customer Alice registers, logs in, and books a slot
    const alice = await registerAndLogin(app, { name: 'Alice Customer' });
    const bookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', bearer(alice.token))
      .send({
        salonId,
        stylistId,
        serviceId,
        date: bookingDate,
        slotTime: targetSlotTime
      });

    expect(bookRes.status).toBe(201);
    const aliceBookingId = bookRes.body.booking._id;

    // 2. Customer Bob registers and logs in
    const bob = await registerAndLogin(app, { name: 'Bob Customer' });

    // 3. Bob attempts to cancel Alice's booking -> returns 403 Forbidden
    const bobCancelRes = await request(app)
      .post(`/api/bookings/${aliceBookingId}/cancel`)
      .set('Authorization', bearer(bob.token));

    expect(bobCancelRes.status).toBe(403);
    expect(bobCancelRes.body).toEqual({ error: 'Not authorized to cancel this booking' });

    // Verify booking is still booked in DB
    const bookingStillActive = await Booking.findById(aliceBookingId);
    expect(bookingStillActive?.status).toBe('booked');

    // 4. Admin logs in
    const adminLoginRes = await request(app)
      .post('/api/login')
      .send({
        email: seedData.admin.email,
        password: seedData.passwords.admin
      });

    expect(adminLoginRes.status).toBe(200);
    const adminToken = adminLoginRes.body.token;

    // 5. Admin cancels Alice's booking -> returns 200 OK
    const adminCancelRes = await request(app)
      .post(`/api/bookings/${aliceBookingId}/cancel`)
      .set('Authorization', bearer(adminToken));

    expect(adminCancelRes.status).toBe(200);
    expect(adminCancelRes.body).toEqual({ message: 'Booking cancelled successfully' });

    // Verify booking is cancelled in DB
    const bookingCancelledByAdmin = await Booking.findById(aliceBookingId);
    expect(bookingCancelledByAdmin?.status).toBe('cancelled');
  });
});
