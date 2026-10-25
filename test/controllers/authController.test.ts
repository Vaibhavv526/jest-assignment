import { Request, Response } from 'express';
import { login } from '../../controllers/authController';
import User from '../../models/User';
import bcrypt from 'bcryptjs';

jest.mock('../../models/User');
jest.mock('bcryptjs');

describe('AuthController - Login', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let responseObject: any;

    beforeEach(() => {
        jest.clearAllMocks();

        responseObject = {};
        mockRequest = {
            body: {
                email: 'test@example.com',
                password: "pass123"
            }
        };

        mockResponse = {
            status: jest.fn().mockImplementation((code) => {
                responseObject.status = code;
                return mockResponse;
            }),
            json: jest.fn().mockImplementation((data) => {
                responseObject.json = data;
                if (responseObject.status === undefined) {
                    responseObject.status = 200;
                }
                return mockResponse;
            })
        };
    });

    it('should return a 200 status and a token when credentials are valid', async () => {
        const mockUser = {
            _id: 'user123',
            email: 'test@example.com',
            role: 'customer',
            password: 'hashedPassword'
        };
        (User.findOne as jest.Mock).mockResolvedValue(mockUser);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        await login(mockRequest as Request, mockResponse as Response);

        expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
        expect(responseObject.status).toBe(200);
        expect(responseObject.json).toHaveProperty('token');
        expect(responseObject.json.role).toBe('customer');
    });

    it('should return 404 if the user is not found', async () => {
        (User.findOne as jest.Mock).mockResolvedValue(null);

        await login(mockRequest as Request, mockResponse as Response);
        expect(responseObject.status).toBe(400);
        // Controller returns { error: 'Invalid credentials' }, not { message: ... }
        expect(responseObject.json.error).toBe('Invalid credentials');
    });
});