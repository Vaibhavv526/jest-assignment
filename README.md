# Salon Booking API - Automated Test Suite & Architecture

A robust, enterprise-grade test automation suite and backend API built with **TypeScript**, **Express**, **Mongoose**, and **Jest**.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites & Environment](#prerequisites--environment)
- [Project Architecture & Folder Structure](#project-architecture--folder-structure)
- [Environment Configuration](#environment-configuration)
- [Installation & Clean Setup](#installation--clean-setup)
- [Test Execution & Configuration](#test-execution--configuration)
  - [Running Tests](#running-tests)
  - [Coverage Report](#coverage-report)
- [Test Strategy & Layering](#test-strategy--layering)
  - [1. Unit Tests (Mock-based)](#1-unit-tests-mock-based)
  - [2. Integration Tests (Supertest + In-Memory MongoDB)](#2-integration-tests-supertest--in-memory-mongodb)
  - [3. End-to-End (E2E) Flow Tests](#3-end-to-end-e2e-flow-tests)
- [Test Utilities & Setup/Teardown Lifecycle](#test-utilities--setupteardown-lifecycle)
- [Assumptions](#assumptions)
- [Known Defects & Improvement Opportunities](#known-defects--improvement-opportunities)

---

## 🌟 Overview

This repository features a complete automated testing suite for a salon booking backend system. It encompasses:
- **Unit Testing Layer**: Isolated controller, route, and middleware unit tests with mocked Mongoose models and spies.
- **Integration Testing Layer**: Supertest HTTP integration tests backed by an ephemeral in-memory MongoDB (`mongodb-memory-server`) validating status codes, response payloads, headers, and database persistence.
- **End-to-End (E2E) Flow Automation**: Full customer and admin lifecycle journeys chaining real API responses across registration, authentication, slot discovery, booking creation, double-booking prevention, cancellation, and role-based authorization.

---

## ⚙️ Prerequisites & Environment

| Component | Verified Version | Command | Notes |
|-----------|------------------|---------|-------|
| **Node.js** | `v25.6.1` | `node -v` | Tested and verified on `v25.6.1` (Supports `>= 18.x`) |
| **npm** | `11.9.0` | `npm -v` | Tested and verified on `11.9.0` |
| **TypeScript** | `Version 6.0.3` | `npx tsc -v` | Tested and verified on `Version 6.0.3` |
| **Database** | None required | N/A | Tests run completely self-contained via `mongodb-memory-server` |

---

## 📁 Project Architecture & Folder Structure

```
Jest-assignment/
├── controllers/
│   ├── authController.ts       # Authentication business logic (register, login)
│   ├── bookingController.ts    # Booking business logic (createBooking, cancelBooking)
│   └── salonController.ts      # Salon business logic (getAvailableSlots)
├── middleware/
│   └── auth.ts                 # JWT verification & user authentication middleware
├── models/
│   ├── Booking.ts              # Booking Mongoose schema & interface
│   ├── Salon.ts                # Salon Mongoose schema & interface
│   ├── Service.ts              # Service Mongoose schema & interface
│   └── User.ts                 # User Mongoose schema & interface
├── routes/
│   ├── authRoutes.ts           # /api/register, /api/login
│   ├── bookingRoutes.ts        # /api/bookings, /api/bookings/:bookingId/cancel
│   └── salonRoutes.ts          # /api/salons/:salonId/available-slots
├── test/
│   ├── controllers/            # Mock-based unit tests
│   │   ├── authController.test.ts
│   │   ├── bookingController.test.ts
│   │   └── salonController.test.ts
│   ├── integration/            # Supertest integration tests with real in-memory DB
│   │   ├── auth.test.ts        # Register, login, edge cases, auth middleware tests
│   │   ├── salons.test.ts      # Available slots calculation, filtering, input validation
│   │   ├── bookings.test.ts    # Booking creation, conflicts, cancellation, authorization
│   │   └── e2e.test.ts         # Multi-step chained customer and admin E2E flows
│   ├── middleware/
│   │   └── auth.test.ts        # Auth middleware unit tests
│   ├── routes/
│   │   └── authRoutes.test.ts  # Express route mounting verification
│   └── test-utils/             # Test harness and lifecycle utilities
│       ├── authHelper.ts       # uniqueUser generator, bearer header formatter, registerAndLogin
│       ├── db.ts               # resetDb collection purge utility
│       ├── seed.ts             # Deterministic seed data (admin, 2 stylists, salon, services)
│       └── setupTestDb.ts      # MongoMemoryServer beforeAll/afterAll lifecycle manager
├── types/
│   └── express/index.d.ts      # Express Request user property type extensions
├── utils/
│   └── seed.ts                 # Seed script for standalone development
├── app.ts                      # Express application definition (clean import for tests)
├── index.ts                    # Server bootstrap & database listener
├── jest.config.js              # Jest configuration with @swc/jest transformer
├── package.json                # Dependencies, test scripts, and engine configs
├── tsconfig.json               # CommonJS TypeScript compiler options
├── .env.example                # Example environment variables template
└── README.md                   # Comprehensive suite documentation
```

---

## 🔐 Environment Configuration

- **`npm test`**: Needs **no `.env` file** and **no local MongoDB instance running**. The test harness automatically launches an isolated in-memory MongoDB database via `mongodb-memory-server`. On the first run, `mongodb-memory-server` downloads a MongoDB binary once (requires an internet connection); subsequent runs execute entirely offline.
- **`.env.example`**: Only used for running the local development server (`npm run dev` or `npm start`). It is never needed or read during test execution.

For local development or running the dev server, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Environment Variables (Development Server Only)

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `PORT` | `3000` | Port for the Express server to listen on |
| `MONGO_URI` | `mongodb://localhost:27017/salon-db` | MongoDB connection string for local development |
| `JWT_SECRET` | `supersecretjwtkey_12345` | Secret key for signing and verifying JWT tokens |

---

## 🚀 Installation & Clean Setup

To install dependencies cleanly:

```bash
# Clean install respecting exact package-lock.json
npm ci
```

*(Optional fallback if not using `npm ci`)*:
```bash
npm install --ignore-scripts
```

---

## 🧪 Test Execution & Configuration

### Running Tests

Execute the full test suite (76 tests across 9 suites):

```bash
npm test
```

Run tests in a specific file:

```bash
npm test test/integration/e2e.test.ts
```

Run tests matching a specific pattern:

```bash
npm test -- -t "Mandatory E2E Lifecycle"
```

### Coverage Report

Generate a line-by-line code coverage report:

```bash
npm run test:coverage
```

### Verified Coverage Output

```
-----------------------|---------|----------|---------|---------|-------------------
File                   | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------------|---------|----------|---------|---------|-------------------
All files              |     100 |      100 |     100 |     100 |                   
 controllers           |     100 |      100 |     100 |     100 |                   
  authController.ts    |     100 |      100 |     100 |     100 |                   
  bookingController.ts |     100 |      100 |     100 |     100 |                   
  salonController.ts   |     100 |      100 |     100 |     100 |                   
 middleware            |     100 |      100 |     100 |     100 |                   
  auth.ts              |     100 |      100 |     100 |     100 |                   
 routes                |     100 |      100 |     100 |     100 |                   
  authRoutes.ts        |     100 |      100 |     100 |     100 |                   
  bookingRoutes.ts     |     100 |      100 |     100 |     100 |                   
  salonRoutes.ts       |     100 |      100 |     100 |     100 |                   
-----------------------|---------|----------|---------|---------|-------------------
Test Suites: 9 passed, 9 total
Tests:       76 passed, 76 total
Snapshots:   0 total
Time:        ~38s
```

### Test Configuration Details

- **Transformer**: `@swc/jest` compiles TypeScript with CommonJS target for fast, high-performance execution.
- **Node Options**: `NODE_OPTIONS=--experimental-vm-modules` is configured in `package.json` to enable Node.js runtime compatibility for dynamic imports during MongoDB driver client metadata handshakes.
- **Run In Band**: `--runInBand` executes test suites sequentially to prevent port/database race conditions.

---

## 🧩 Test Strategy & Layering

The test architecture is divided into three tiers:

### 1. Unit Tests (Mock-based)
- **Files**: `test/controllers/*.test.ts`, `test/middleware/*.test.ts`, `test/routes/*.test.ts`
- **Count**: 41 tests
- **Focus**: Verifies isolated business logic, branch coverage, and error handlers by mocking Mongoose model functions (`find`, `findOne`, `create`, `findById`, `save`) and bcrypt/jwt libraries.

### 2. Integration Tests (Supertest + In-Memory MongoDB)
- **Files**: `test/integration/auth.test.ts`, `test/integration/salons.test.ts`, `test/integration/bookings.test.ts`
- **Count**: 33 tests
- **Focus**: Tests real HTTP requests against Express `app.ts` with a real in-memory MongoDB. Verifies:
  - **`POST /api/register`**: 201 created, 400 email already in use, password hashing.
  - **`POST /api/login`**: 200 token generation, 400 invalid password, 400 unregistered email.
  - **`GET /api/salons/:salonId/available-slots`**: Slot generation for 30m and 60m services, salon open/close constraints (09:00 - 18:00), stylist availability, 400 missing query params, 404 salon/service not found.
  - **`POST /api/bookings`**: Booking creation, 400 slot conflict (double booking), 400 missing date, 404 service not found.
  - **`POST /api/bookings/:bookingId/cancel`**: Own booking cancellation, 400 already cancelled, 404 not found, 403 authorization refusal for other customers, 200 admin override.
  - **Authentication & Middleware**: 401 no token, 401 malformed token, 401 expired token, 401 wrong secret, 401 deleted user.

### 3. End-to-End (E2E) Flow Tests
- **File**: `test/integration/e2e.test.ts`
- **Count**: 2 comprehensive chained scenarios
- **Scenarios**:
  1. **Full Customer Lifecycle**:
     - Register new customer Alice -> Login Alice -> Query available slots -> Book slot (`09:30`) -> Verify slot is no longer returned in available slots -> Cancel booking -> Verify slot is restored in available slots -> Attempt double cancellation and verify 400 Bad Request.
  2. **Role-Based Authorization Flow**:
     - Alice registers, logs in, and books a slot.
     - Bob registers, logs in, and attempts to cancel Alice's booking -> **403 Forbidden**.
     - Alice's booking remains active in database.
     - Admin logs in (`admin@salon.test`) and cancels Alice's booking -> **200 OK**.
     - Alice's booking status transitions to `cancelled` in database.

---

## 🛠️ Test Utilities & Setup/Teardown Lifecycle

The suite adheres to DRY principles with dedicated helper modules located in `test/test-utils/`:

| Utility | File | Purpose |
|---------|------|---------|
| `setupTestDb()` | `test/test-utils/setupTestDb.ts` | Manages `MongoMemoryServer` creation and `mongoose.connect()` in `beforeAll`, and disconnects/stops in `afterAll`. |
| `resetDb()` | `test/test-utils/db.ts` | Purges all collections between test cases (`beforeEach`) to ensure complete test isolation without restarting the in-memory server. |
| `seedTestDb()` | `test/test-utils/seed.ts` | Creates standard test data: 1 admin (`admin@salon.test`), 2 stylists (`stylist1@salon.test`, `stylist2@salon.test`), 1 salon (09:00–18:00), and 2 services (30m Express Cut, 60m Full Color). |
| `authHelper` | `test/test-utils/authHelper.ts` | Provides `uniqueUser()` (collision-free credential generator), `bearer(token)` (header formatter), and `registerAndLogin(app)` (composite helper). |

---

## 📌 Assumptions & Architecture Decisions

1. **Salon Business Hours**: Salons operate on strict 24-hour time strings (`"HH:mm"` format, e.g., `"09:00"` to `"18:00"`). Service durations are in minutes. Available slots are evaluated at 30-minute intervals.
2. **Customer Self-Registration**: Only `customer` accounts can self-register via `POST /api/register`. Stylist and admin accounts must be provisioned via admin seed or administrative endpoints.
3. **Cancellation Permissions**: A booking can only be cancelled by the customer who created it or by any user with the `admin` role.
4. **App/Server Decoupling (`app.ts` & `index.ts`)**: `app.ts` was extracted from `index.ts` so that integration and E2E tests can import the configured Express `app` directly without establishing a real MongoDB database connection or binding to a network port. `index.ts` remains the dedicated entry point for local and production deployment, handling `mongoose.connect()` and `.listen(PORT)`.
5. **TypeScript Tooling & Version Compatibility**: In `package.json`, `typescript` was updated from `^7.0.2` to `^6.0.3`. The real reason for this change is that **TypeScript version 7.x does not exist on npm** (the latest official published major versions on the npm registry are `5.x` and `6.x-dev`). Attempting to install or build with `^7.0.2` caused npm resolution errors and compiler failures. Aligning to a published version (`^6.0.3`) resolved all type checking and compiler compatibility issues with `@swc/jest` and `tsc`.

---

## ⚠️ Known Defects & Improvement Opportunities

Per instructions, real application bugs have been documented in the test suite using `it.failing()` blocks so tests validate the defect without mutating business logic in `controllers/`:

1. **Mongoose CastError on Invalid ObjectIDs (Returns 500 instead of 400/404)**:
   - **Location**: `controllers/salonController.ts` and `controllers/bookingController.ts`
   - **Behavior**: Passing a malformed MongoDB ObjectID string (e.g., `/api/salons/invalid-id/available-slots`) causes Mongoose to throw a `CastError`. The controllers catch this in a generic `catch (error)` block and return `500 Server error` rather than a descriptive `400 Bad Request` or `404 Not Found`.
   - **Documented In**: `test/integration/salons.test.ts`, `test/integration/bookings.test.ts`
2. **Missing Input Validation on Request Body**:
   - **Location**: `controllers/bookingController.ts` (`slotTime`) and `controllers/authController.ts` (`password`)
   - **Behavior**: If `slotTime` is omitted in `createBooking`, `timeToMins(slotTime)` throws `TypeError: Cannot read properties of undefined (reading 'split')`, yielding HTTP 500. Similarly, missing `password` in registration throws in `bcrypt.hash()`, yielding HTTP 500 instead of HTTP 400.
   - **Documented In**: `test/integration/auth.test.ts`, `test/integration/bookings.test.ts`
3. **Input Sanitization**:
   - Recommendation: Integrate Joi or Zod middleware to validate request bodies and query parameters prior to controller invocation.
