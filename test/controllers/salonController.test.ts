import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { getAvailableSlots } from '../../controllers/salonController';
import Salon from '../../models/Salon';
import Service from '../../models/Service';
import Booking from '../../models/Booking';
import User from '../../models/User';

// mock the db models
jest.mock('../../models/Salon');
jest.mock('../../models/Service');
jest.mock('../../models/Booking');
jest.mock('../../models/User');

const salonFindById = Salon.findById as jest.Mock;
const serviceFindById = Service.findById as jest.Mock;
const userFind = User.find as jest.Mock;
const bookingFind = Booking.find as jest.Mock;

function mockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function mockReq(query: any = {}, params: any = {}) {
    return { params, query } as any as Request;
}

function defaultSetup(opts: any = {}) {
    const {
        openTime = '09:00',
        closeTime = '17:00',
        duration = 60,
        stylists = [{ _id: 'stylist-a', name: 'Anita' }],
        bookings = []
    } = opts;

    salonFindById.mockResolvedValue({ _id: 'salon1', openTime, closeTime });
    serviceFindById.mockResolvedValue({ _id: 'svc1', name: 'Haircut', duration });
    userFind.mockResolvedValue(stylists);
    bookingFind.mockResolvedValue(bookings);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterAll(() => {
    jest.restoreAllMocks();
});

describe('getAvailableSlots', () => {

    describe('validation and not found', () => {
        it('returns 400 if date or serviceId is missing', async () => {
            const res = mockRes();
            await getAvailableSlots(mockReq({}, { salonId: '1' }), res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'date and serviceId are required' });

            await getAvailableSlots(mockReq({ date: '2025-01-15' }, { salonId: '1' }), res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('returns 400 for empty strings', async () => {
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '', serviceId: 'svc1' }, { salonId: '1' }), res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('returns 404 if salon or service not found', async () => {
            defaultSetup();
            salonFindById.mockResolvedValue(null);
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: 'salon1' }), res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Salon or Service not found' });
        });

        it('calls db with correct ids', async () => {
            defaultSetup();
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc-abc' }, { salonId: 'salon-xyz' }), res);
            expect(salonFindById).toHaveBeenCalledWith('salon-xyz');
            expect(serviceFindById).toHaveBeenCalledWith('svc-abc');
        });
    });

    // --- Success & Slot Gen ---
    describe('success and slot generation', () => {
        it('returns basic info and slots array', async () => {
            defaultSetup({ duration: 45 });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);

            const body = res.json.mock.calls[0][0];
            expect(body.date).toBe('2025-01-15');
            expect(body.service).toBe('Haircut');
            expect(body.duration).toBe(45);
            expect(Array.isArray(body.availableSlots)).toBe(true);
        });

        it('generates slots at 30 min intervals', async () => {
            defaultSetup({ openTime: '09:00', closeTime: '11:00', duration: 30 });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);

            const slots = res.json.mock.calls[0][0].availableSlots;
            const times = slots.filter((s: any) => s.stylistId === 'stylist-a').map((s: any) => s.time);
            expect(times).toEqual(['09:00', '09:30', '10:00', '10:30']);
        });

        it('doesnt generate slot if it ends after closeTime', async () => {
            defaultSetup({ openTime: '09:00', closeTime: '11:00', duration: 60 });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);

            const slots = res.json.mock.calls[0][0].availableSlots;
            const times = slots.filter((s: any) => s.stylistId === 'stylist-a').map((s: any) => s.time);
            expect(times).not.toContain('10:30'); // 10:30 + 60 = 11:30 > 11:00
            expect(times).toEqual(['09:00', '09:30', '10:00']);
        });

        it('handles duration not multiple of 30', async () => {
            defaultSetup({ openTime: '09:00', closeTime: '11:00', duration: 45 });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);

            const slots = res.json.mock.calls[0][0].availableSlots;
            const times = slots.filter((s: any) => s.stylistId === 'stylist-a').map((s: any) => s.time);
            expect(times).toEqual(['09:00', '09:30', '10:00']);
        });

        it('returns no slots if openTime >= closeTime', async () => {
            defaultSetup({ openTime: '10:00', closeTime: '10:00', duration: 30 });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);
            expect(res.json.mock.calls[0][0].availableSlots).toEqual([]);
        });

        it('queries users with role stylist', async () => {
            defaultSetup();
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);
            expect(userFind).toHaveBeenCalledWith({ role: 'stylist' });
        });
    });

    // --- Conflicts ---
    describe('booking conflicts', () => {
        const dayOpts = { openTime: '09:00', closeTime: '12:00', duration: 60 };

        it('excludes slot that overlaps existing booking', async () => {
            defaultSetup({ ...dayOpts, bookings: [{ stylistId: 'stylist-a', startTime: '10:00', endTime: '11:00', status: 'booked' }] });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);

            const slots = res.json.mock.calls[0][0].availableSlots;
            const times = slots.filter((s: any) => s.stylistId === 'stylist-a').map((s: any) => s.time);
            expect(times).not.toContain('10:00');
            expect(times).not.toContain('09:30'); // partial overlap
            expect(times).not.toContain('10:30'); // partial overlap
        });

        it('includes slot if it touches booking but doesnt overlap', async () => {
            defaultSetup({ ...dayOpts, bookings: [{ stylistId: 'stylist-a', startTime: '10:00', endTime: '11:00', status: 'booked' }] });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);

            const slots = res.json.mock.calls[0][0].availableSlots;
            const times = slots.filter((s: any) => s.stylistId === 'stylist-a').map((s: any) => s.time);
            expect(times).toContain('09:00');
            expect(times).toContain('11:00');
        });

        it('doesnt affect other stylists', async () => {
            const stylists = [
                { _id: 'stylist-a', name: 'Anita' },
                { _id: 'stylist-b', name: 'Bobby' }
            ];
            defaultSetup({
                ...dayOpts,
                stylists,
                bookings: [{ stylistId: 'stylist-a', startTime: '09:00', endTime: '12:00', status: 'booked' }]
            });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);

            const slots = res.json.mock.calls[0][0].availableSlots;
            const timesA = slots.filter((s: any) => s.stylistId === 'stylist-a').map((s: any) => s.time);
            const timesB = slots.filter((s: any) => s.stylistId === 'stylist-b').map((s: any) => s.time);

            expect(timesA).toEqual([]);
            expect(timesB.length).toBeGreaterThan(0);
        });

        it('handles ObjectId comparison correctly', async () => {
            const hex = '64b7f0c2a1b2c3d4e5f60718';
            const stylist = { _id: new Types.ObjectId(hex), name: 'Charu' };
            defaultSetup({
                ...dayOpts,
                stylists: [stylist],
                bookings: [{ stylistId: new Types.ObjectId(hex), startTime: '09:00', endTime: '12:00', status: 'booked' }]
            });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);
            expect(res.json.mock.calls[0][0].availableSlots).toEqual([]);
        });
    });

    // --- DB Queries ---
    describe('db queries', () => {
        it('filters bookings by status booked, date and salonId', async () => {
            defaultSetup();
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-06-30', serviceId: 'svc1' }, { salonId: 'salon-other' }), res);

            expect(bookingFind).toHaveBeenCalledWith({
                salonId: 'salon-other',
                date: '2025-06-30',
                status: 'booked'
            });
        });
    });

    // --- Errors ---
    describe('error handling', () => {
        it('returns 500 if db throws', async () => {
            defaultSetup();
            salonFindById.mockRejectedValue(new Error('db down'));
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
        });

        it('handles CastError for bad ids', async () => {
            const castError = Object.assign(new Error('Cast failed'), { name: 'CastError' });
            salonFindById.mockRejectedValue(castError);
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: 'bad-id' }), res);
            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('returns 500 if salon is missing open/close times', async () => {
            defaultSetup();
            salonFindById.mockResolvedValue({ _id: 'salon1' }); // missing times
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    // --- Edge cases ---
    describe('edge cases', () => {
        it('handles 0 duration', async () => {
            defaultSetup({ openTime: '09:00', closeTime: '10:00', duration: 0 });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);
            expect(res.status).not.toHaveBeenCalledWith(500);
        });

        it('handles negative duration without crashing', async () => {
            defaultSetup({ openTime: '09:00', closeTime: '10:00', duration: -30 });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);
            expect(res.status).not.toHaveBeenCalledWith(500);
        });

        it('handles large number of stylists/bookings', async () => {
            const stylists = Array.from({ length: 20 }, (_, i) => ({ _id: `s - ${i} `, name: `S ${i}` }));
            const bookings = Array.from({ length: 50 }, (_, i) => ({
                stylistId: `s - ${i % 20}`,
                startTime: '09:00',
                endTime: '10:00',
                status: 'booked'
            }));
            defaultSetup({ stylists, bookings });
            const res = mockRes();
            await getAvailableSlots(mockReq({ date: '2025-01-15', serviceId: 'svc1' }, { salonId: '1' }), res);
            expect(res.status).not.toHaveBeenCalledWith(500);
        });
    });
});