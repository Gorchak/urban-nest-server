# Urban Nest - Backend Server

Node.js/Express REST API backend for Urban Nest, using MongoDB Atlas with the native driver.

## Prerequisites

- Node.js >= 18
- MongoDB Atlas account (connection string in .env)

## Setup

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| PORT | Server port | 3000 |
| CLIENT_URL | Angular frontend URL | http://uliastore.com.ua |
| MONGODB_URI | MongoDB Atlas connection string | - |
| NODE_ENV | Environment | development |
| ADMIN_ORDER_EMAIL | Recipient of new-order email notifications | Uliaconcept@gmail.com |
| RESEND_API_KEY | Resend API key with permission to send email | - |
| RESEND_FROM_EMAIL | Sender on the domain verified in Resend | - |
| NEWSLETTER_FROM_EMAIL | Newsletter sender on a domain verified in Resend (falls back to `RESEND_FROM_EMAIL`) | - |
| FRONTEND_URL | Public frontend origin used in product and unsubscribe links | https://uliastore.com.ua |
| ORDER_SMS_RECIPIENT | Phone number that receives order SMS notifications | +380679403549 |
| SMS_PROVIDER_URL | HTTP endpoint used to send order SMS notifications | - |
| SMS_API_TOKEN | Bearer token for the SMS provider endpoint | - |
| SMS_SENDER | Sender name passed to the SMS provider | UrbanNest |
| ADMIN_SALES_URL | Admin sales page URL included in order notifications | http://uliastore.com.ua/admin/sales |

`ORDER_SMS_RECIPIENT` accepts `0679403549`, `380679403549`, or `+380679403549`; the server normalizes it to `+380679403549` before sending.

Order emails are sent through Resend after a sale is created. Set `RESEND_FROM_EMAIL`
to an address on the verified domain, for example
`Urban Nest <orders@uliastore.com.ua>`. The address does not need a separate
mailbox in Resend, but using a reply-capable address is recommended.

## Scripts

```bash
npm run dev      # Start with nodemon (development)
npm start        # Start server (production)
npm run newsletter:send # Send only new, previously unsent products
```

## Newsletter and Render Cron Job

The public API uses `POST /api/newsletter/subscribe` and token-based
`GET /api/newsletter/unsubscribe`. Admin preview and sending are protected by
the existing Auth0 admin middleware at `GET /api/admin/newsletter/preview` and
`POST /api/admin/newsletter/send`.

In Render, create a **Cron Job** from the same backend repository and configure:

- Root Directory: `server`
- Build Command: `npm ci`
- Start/Command: `npm run newsletter:send`
- Schedule: `0 8 1 * *` (08:00 UTC on the first day of every month; 11:00 Kyiv
  during EEST and 10:00 during EET)
- Environment variables: use the same `MONGODB_URI`, `RESEND_API_KEY`,
  `NEWSLETTER_FROM_EMAIL`, `RESEND_FROM_EMAIL`, `FRONTEND_URL`, and
  `NODE_ENV=production` values as the backend web service.

The command connects to MongoDB, runs the shared newsletter service once, logs
only aggregate results, closes the connection, and exits. Campaign history and
a unique partial MongoDB index prevent concurrent manual/Cron runs from sending
the same product twice.

## Project Structure

```
src/
├── config/
│   ├── collections.js             # Collection constants & helpers
│   └── database.js                # MongoDB Atlas connection (native driver)
├── controllers/
│   ├── clothesController.js       # Clothes request handlers
│   └── userController.js          # User request handlers
├── middleware/
│   ├── ApiError.js                # Custom error class
│   ├── authMiddleware.js          # JWT protection & role authorization
│   ├── errorHandler.js            # Global error handler
│   └── notFoundHandler.js         # 404 handler
├── routes/
│   ├── clothesRoutes.js           # /api/clothes
│   └── userRoutes.js              # /api/users
├── services/
│   ├── clothesService.js          # Clothes business logic
│   └── userService.js             # User business logic
├── utils/
│   ├── apiResponse.js             # Standard API response format
│   └── asyncHandler.js            # Async route wrapper
├── app.js                         # Express app setup
└── server.js                      # Entry point
```

## MongoDB Collections

Database: `urban-nest`

| Collection | Description |
|---|---|
| users | User accounts |
| clothes | Clothing items |
| references | Reference data |

More collections can be added via `src/config/collections.js`.

## API Endpoints

### Base

| Method | Endpoint | Description |
|---|---|---|
| GET | /api | API info & available endpoints |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/users | Get all users (paginated) |
| GET | /api/users/:id | Get user by ID |
| POST | /api/users | Create user |
| PUT | /api/users/:id | Update user |
| DELETE | /api/users/:id | Delete user |

### Clothes

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/clothes | Get all clothes (paginated) |
| GET | /api/clothes/:id | Get clothes by ID |
| POST | /api/clothes | Create clothes item |
| PUT | /api/clothes/:id | Update clothes item |
| DELETE | /api/clothes/:id | Delete clothes item |

## API Response Format

**Success:**
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Resource not found",
  "statusCode": 404
}
```

## Architecture

- **MongoDB native driver** — no ODM/ORM, direct collection access
- **Controllers** handle HTTP requests/responses only
- **Services** contain all business logic and database operations
- **Config/collections.js** provides centralized collection access for future collections
- **Middleware** handles auth, errors, and 404s
- **Utils** provide reusable helpers (asyncHandler, ApiResponse)

Ready for future additions: references collection, Auth0/JWT auth, comments, likes, media, subscriptions, chat, WebSocket, notifications, caching, rate limiting, Docker, microservices.
