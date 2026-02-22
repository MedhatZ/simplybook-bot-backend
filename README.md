SimplyBook Bot Middleware (JSON-RPC)

A lightweight Node.js middleware that connects a chatbot to the SimplyBook JSON-RPC API.

This service acts as a secure backend layer between a WhatsApp/FAQ bot and SimplyBook, handling authentication, booking logic, and business rules.

Overview

This backend provides three core endpoints:

Check availability

Create booking

Reschedule booking (with original appointment time validation rule)

All credentials are stored securely on the server using environment variables.

Architecture

Bot → Node.js Middleware → SimplyBook JSON-RPC API

Node.js

Express

Axios

Zod (validation)

Luxon (timezone handling)

express-rate-limit

dotenv

Features

JSON-RPC 2.0 integration (SimplyBook user API)

Token-based authentication with automatic refresh

Booking signature generation using Secret Key (MD5)

Availability filtering with optional time window

Reschedule validation based on original appointment time

Rate limiting protection

Sanitized error responses

Clean JSON responses for chatbot consumption

API Endpoints
1. Check Availability

POST /api/availability

Request body:

{
  "service_id": 1,
  "date": "2026-03-10",
  "from_time": "18:00",
  "to_time": "21:00",
  "provider_id": 1
}

Response:

{
  "success": true,
  "data": [
    {
      "provider_id": 1,
      "time": "18:00:00"
    }
  ]
}
2. Create Booking

POST /api/booking

Request body:

{
  "service_id": 1,
  "provider_id": 1,
  "date": "2026-03-10",
  "time": "16:00:00",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+6581234567"
}

Response:

{
  "success": true,
  "data": {
    "bookingId": "8019",
    "bookingHash": "...",
    "requirePayment": true,
    "startDateTime": "2026-03-10 16:00:00",
    "endDateTime": "2026-03-10 18:00:00"
  }
}
3. Reschedule Booking

POST /api/reschedule

Request body:

{
  "booking_id": "8019",
  "booking_hash": "...",
  "new_date": "2026-03-15",
  "new_time": "14:00:00"
}

Behavior:

Fetches original booking details

Validates minimum time difference before original appointment

Verifies slot availability

Performs reschedule via SimplyBook

Response:

{
  "success": true,
  "data": {
    "old_start": "2026-03-10 16:00:00",
    "new_start": "2026-03-15 14:00:00",
    "new_end": "2026-03-15 16:00:00",
    "moved": true
  }
}
Environment Variables

Create a .env file based on .env.example:

PORT=3000
SIMPLYBOOK_BASE_URL=https://user-api.simplybook.me
SIMPLYBOOK_COMPANY=your_company_login
SIMPLYBOOK_API_KEY=your_api_key
SIMPLYBOOK_SECRET_KEY=your_secret_key
SALON_TIMEZONE=Asia/Singapore
SALON_UTC_OFFSET_MINUTES=480
MIN_RESCHEDULE_HOURS=24
Installation

Install dependencies

npm install

Configure environment variables

Create a .env file.

Start server

npm start

Server runs on:

http://localhost:3000
Security Notes

API credentials are never exposed to the client.

All sensitive keys must remain in .env.

.env is excluded via .gitignore.

Error responses are sanitized.

Deployment Notes

Recommended:

Node.js v18+

Use PM2 for process management

Configure reverse proxy (Nginx) if exposing publicly

Ensure environment variables are properly set in production

Status

Phase 1 complete:

Availability

Create Booking

Reschedule with validation

Rate limiting

Clean API structure
