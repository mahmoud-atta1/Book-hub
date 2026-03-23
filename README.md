# Book Hub

Book Hub is a full-stack library commerce app where users buy books and admins manage catalog inventory and order approvals.

## Core Concept

- `User`: browse catalog, place purchase requests, and track personal orders.
- `Admin`: full catalog CRUD, inventory stats, and full transaction visibility.
- Single system for marketplace + operations in one dashboard.

## Tech Stack

- Backend: Node.js, Express, MongoDB, Mongoose
- Frontend: HTML, CSS, Vanilla JavaScript
- Authentication: JWT
- Validation: express-validator

## Main API Modules

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### Books (Catalog)

- `GET /api/v1/books`
- `GET /api/v1/books/:id`
- `POST /api/v1/books` (admin)
- `PUT /api/v1/books/:id` (admin)
- `DELETE /api/v1/books/:id` (admin)
- `GET /api/v1/books/stats/overview` (admin)

### Transactions

- `GET /api/v1/transactions/my`
- `GET /api/v1/transactions/stats/overview`
- `POST /api/v1/transactions/purchase`
- `PATCH /api/v1/transactions/:id/status` (admin)
- `PATCH /api/v1/transactions/:id/approve` (admin)
- `PATCH /api/v1/transactions/:id/reject` (admin)
- `GET /api/v1/transactions` (admin)

Order flow:
- user sends purchase request with contact data (`customerName`, `customerPhone`, `customerAddress`, optional `customerNotes`)
- admin updates status (`pending` -> `in_transit` -> `completed`) or rejects the order
- stock is deducted when status moves to `in_transit` or `completed`

## Environment Setup

Copy `.env.example` to `.env` and fill values:

```env
PORT=3000
NODE_ENV=development
DB_URI=mongodb://127.0.0.1:27017/book_hub
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=7d
ADMIN_EMAILS=admin@book-hub.local
CORS_ORIGIN=http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000,http://127.0.0.1:3000
```

`ADMIN_EMAILS` controls which registered emails receive admin role automatically.

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

- `npm run dev` start development server with nodemon
- `npm start` start production server
- `npm run lint` lint backend code
- `npm test` run jest checks (configured for environments without test files)
