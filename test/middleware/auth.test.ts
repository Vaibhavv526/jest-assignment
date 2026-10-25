import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import jwt from 'jsonwebtoken';
import User from '../../models/User';

jest.mock('jsonwebtoken');
jest.mock('../../models/User');

describe('Authentication Check', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {

        jest.resetAllMocks();

        mockReq = {
            header: jest.fn(),
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        mockNext = jest.fn();
    });
    it('when the Authorization header is missing', async () => {
        (mockReq.header as jest.Mock).mockReturnValue(undefined);

        await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('when the Authorization is present but does not contain a token', async () => {
        (mockReq.header as jest.Mock).mockReturnValue('Bearer ');

        await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('when the provided JWT is malformed or tampered with', async () => {
        (mockReq.header as jest.Mock).mockReturnValue('Bearer malformed.token.string');

        (jwt.verify as jest.Mock).mockImplementation(() => {
            throw new Error('JWT malformed');
        });

        await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('when the JWT is expired', async () => {
        (mockReq.header as jest.Mock).mockReturnValue('Bearer expired.jwt.token');

        (jwt.verify as jest.Mock).mockImplementation(() => {
            const expiredError = new Error('jwt expired');
            expiredError.name = 'TokenExpiredError';
            throw expiredError;
        });

        await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('when the JWT is signed with a defferent secret key', async () => {
        (mockReq.header as jest.Mock).mockReturnValue('Bearer token.signed.with.wrong.secret');

        (jwt.verify as jest.Mock).mockImplementation(() => {
            const signError = new Error('invalid sign');
            signError.name = 'JWT_Error';
            throw signError;
        });

        await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('when the toke is valid but the user does not exist in the database', async () => {
        (mockReq.header as jest.Mock).mockReturnValue('Bearer valid.jwt.token');

        (jwt.verify as jest.Mock).mockReturnValue({ userId: 'userUnknown', role: 'user' });
        (User.findById as jest.Mock).mockResolvedValue(null);

        await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(User.findById).toHaveBeenCalledWith('userUnknown');
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
        expect(mockNext).not.toHaveBeenCalled();
    })
});