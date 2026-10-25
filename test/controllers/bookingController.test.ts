import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { createBooking, cancelBooking } from '../../controllers/bookingController';
import Booking from '../../models/Booking'
import Service from '../../models/Service'

jest.mock('../../models/Booking', () => {
    const BookingMock: any = jest.fn();
    BookingMock.find = jest.fn();
    BookingMock.findById = jest.fn();
    return { __esModule: true, default: BookingMock };
});

jest.mock('../../models/Service');

jest.mock('../../models/Salon');

const objId = () => new mongoose.Types.ObjectId();

const mockReq = (body: Record<string, unknown>): Request => (
    {
        body,
        user: { _id: objId(), roles: 'customer' },
    } as unknown as Request
);

const mockRes = (): Response => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('Validation - createBooking', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    //test-01
    it(`return 400 with 'date is required' - date is missing`, async () => {
        const req = mockReq({
            salonId: objId(),
            stylishId: objId(),
            serviceId: objId(),
            slotTime: '10:00',
        });
        const res = mockRes();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "date is required" });
        expect(Service.findById).not.toHaveBeenCalled();
        expect(Booking.find).not.toHaveBeenCalled();
        expect(Booking).not.toHaveBeenCalled();
    });

    //Test-02
    it('return 400 with "date is required" - date is empty', async () => {
        const req = mockReq({
            salonId: objId(),
            stylishId: objId(),
            serviceId: objId(),
            slotTime: '11:00',
            date: ""
        });
        const res = mockRes();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'date is required' });
        expect(Service.findById).not.toHaveBeenCalled();
        expect(Booking.find).not.toHaveBeenCalled();
        expect(Booking).not.toHaveBeenCalled();
    });

    //Test-03
    it('should return 404 - service not foumd', async () => {
        (Service.findById as jest.Mock).mockResolvedValue(null);

        const req = mockReq({
            salonId: objId(),
            stylishId: objId(),
            serviceId: objId(),
            slotTime: '11:00',
            date: '2026-11-08'
        });

        const res = mockRes();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ "error": 'Service not found' });

        expect(Booking.find).not.toHaveBeenCalled();
        expect(Booking).not.toHaveBeenCalled();
    });

    //Test-04
    it('should able to revoke correct ServiceId', async () => {
        (Service.findById as jest.Mock).mockResolvedValue(1);

        const serviceId = objId();
        const req = mockReq({
            salonId: objId(),
            stylishId: objId(),
            serviceId,
            slotTime: '10:00',
            date: '2026-11-08'
        });

        const res = mockRes();

        await createBooking(req, res);

        expect(Service.findById).toHaveBeenCalledTimes(1);
        expect(Service.findById).toHaveBeenCalledWith(serviceId);
    });

    //Test-05
    it('should able to create booking and return 201', async () => {
        (Booking.find as jest.Mock).mockResolvedValue([]);
        (Service.findById as jest.Mock).mockResolvedValue({ duration: 60 });

        const salonId = objId();
        const stylistId = objId();
        const serviceId = objId();
        const date = '2026-11-15';

        const saveMock = jest.fn().mockResolvedValue(undefined);
        (Booking as unknown as jest.Mock).mockImplementation(function () {
            return { save: saveMock };
        });

        const req = mockReq({
            salonId,
            stylistId,
            serviceId,
            slotTime: '10:00',
            date
        });

        const res = mockRes();
        await createBooking(req, res);

        expect(Booking.find).toHaveBeenCalledWith({
            salonId,
            date,
            stylistId,
            status: "booked"
        });

        expect(saveMock).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Booking created successfully",
            booking: expect.anything(),
        });
    });

    //Test=06
    it('should able to fetch correct data', async () => {
        const salonId = objId();
        const stylistId = objId();
        const serviceId = objId();
        const date = '2026-11-15';

        (Service.findById as jest.Mock).mockResolvedValue({ duration: 30 });
        (Booking.find as jest.Mock).mockResolvedValue([]);
        (Booking as unknown as jest.Mock).mockImplementation(function () {
            return { save: jest.fn().mockResolvedValue(undefined) };
        });

        const req = mockReq({
            salonId,
            stylistId,
            serviceId,
            slotTime: '10:00',
            date
        });
        const res = mockRes();

        await createBooking(req, res);

        expect(Booking.find).toHaveBeenCalledTimes(1);
        expect(Booking.find).toHaveBeenCalledWith({
            salonId, date, stylistId, status: 'booked'
        });
    });

    //Test-08
    it('should able to perform consecutive booking', async () => {
        (Service.findById as jest.Mock).mockResolvedValue({ duration: 30 });
        (Booking.find as jest.Mock).mockResolvedValue([
            { startTime: '10:00', endTime: '11:00' },
        ]);

        const saveMock = jest.fn().mockResolvedValue(undefined);
        (Booking as unknown as jest.Mock).mockImplementation(function () {
            return { save: saveMock };
        });

        const req = mockReq({
            salonId: objId(),
            stylistId: objId(),
            serviceId: objId(),
            slotTime: "11:00",
            date: '2026-11-15'
        });
        const res = mockRes();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(saveMock).toHaveBeenCalledTimes(1);
    });

    //test-09
    it('should able to detect conflict in time scheduling', async () => {
        (Service.findById as jest.Mock).mockResolvedValue({ duration: 30 });
        (Booking.find as jest.Mock).mockResolvedValue([
            { startTime: '10:00', endTime: '11:00' },
        ]);
        const saveMock = jest.fn().mockResolvedValue(undefined);
        (Booking as unknown as jest.Mock).mockImplementation(function () {
            return { save: saveMock };
        });

        const req = mockReq({
            salonId: objId(),
            stylistId: objId(),
            serviceId: objId(),
            slotTime: "10:00",
            date: '2026-11-15'
        });
        const res = mockRes();

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Time slot is no longer available' });
        expect(saveMock).not.toHaveBeenCalled();
    });
});


const mockCancelReq = (
    params: Record<string, string>,
    user: { _id: mongoose.Types.ObjectId; role: string } = { _id: objId(), role: "customer" }
): Request => ({ params, user } as unknown as Request);


describe('validation - cancelBooking', () => {
    // Test-10 
    it('should able to detect no booking at canclation time', async () => {
        (Booking.findById as jest.Mock).mockResolvedValue(null);

        const req = mockCancelReq({ BookingId: objId().toString() });
        const res = mockRes();

        await cancelBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: "Booking not found" });
    });

    // test-11
    it('should able to correctly delete the booking', async () => {
        (Booking.findById as jest.Mock).mockResolvedValue(null);

        const bookingId = objId().toString();
        const req = mockCancelReq({ bookingId });
        const res = mockRes();

        await cancelBooking(req, res);

        expect(Booking.findById).toHaveBeenCalled();
        expect(Booking.findById).toHaveBeenCalledWith(bookingId);

    })
})