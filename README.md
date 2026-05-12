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
| CLIENT_URL | Angular frontend URL | http://localhost:4200 |
| MONGODB_URI | MongoDB Atlas connection string | - |
| NODE_ENV | Environment | development |

## Scripts

```bash
npm run dev      # Start with nodemon (development)
npm start        # Start server (production)
```

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
