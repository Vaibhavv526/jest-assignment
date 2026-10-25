import request from 'supertest';
import { Express } from 'express';

let userCounter = 0;

export interface TestUserCredentials {
  name: string;
  email: string;
  password: string;
}

export const uniqueUser = (prefix = 'user'): TestUserCredentials => {
  userCounter++;
  const timestamp = Date.now();
  return {
    name: `Test ${prefix} ${userCounter}`,
    email: `${prefix}_${timestamp}_${userCounter}@test.com`,
    password: 'password123'
  };
};

export const bearer = (token: string): string => {
  return `Bearer ${token}`;
};

export interface AuthSession {
  user: TestUserCredentials;
  token: string;
  userId: string;
  role: string;
  registerResponse: request.Response;
  loginResponse: request.Response;
}

export const registerAndLogin = async (
  app: Express,
  customCredentials?: Partial<TestUserCredentials>
): Promise<AuthSession> => {
  const user: TestUserCredentials = {
    ...uniqueUser(),
    ...customCredentials
  };

  const registerResponse = await request(app)
    .post('/api/register')
    .send(user);

  const loginResponse = await request(app)
    .post('/api/login')
    .send({
      email: user.email,
      password: user.password
    });

  return {
    user,
    token: loginResponse.body.token,
    userId: loginResponse.body.userId,
    role: loginResponse.body.role,
    registerResponse,
    loginResponse
  };
};
