<div align="center">

# 📚 Book Hub

**A full-stack library commerce platform — where readers shop and admins manage everything.**

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

[Features](#-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [API Reference](#-api-reference) • [Project Structure](#-project-structure)

</div>

---

## 📖 About

**Book Hub** is a full-stack library commerce application with two distinct roles:

| Role | Capabilities |
|------|-------------|
| 👤 **User** | Browse the book catalog, place purchase requests, and track personal order history |
| 🛡️ **Admin** | Full CRUD on catalog, manage inventory, approve/reject orders, and view transaction stats |

A single unified system for both the marketplace experience and backend operations.

---

## ✨ Features

### For Users
- 🔐 Register & login with secure JWT authentication
- 📚 Browse and search the full book catalog
- 🛒 Place purchase requests with delivery details
- 📦 Track order status in real time (`pending` → `in_transit` → `completed`)

### For Admins
- ➕ Add, edit, and delete books from the catalog
- 📊 View inventory and sales statistics overview
- ✅ Approve or ❌ reject pending orders
- 👁️ Full visibility into all transactions across all users

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Database** | MongoDB + Mongoose |
| **Authentication** | JSON Web Token (JWT) |
| **Validation** | express-validator |
| **Security** | Helmet, CORS |
| **Logging** | Morgan |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Dev Tools** | Nodemon, ESLint, Jest |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16+
- [MongoDB](https://www.mongodb.com/) (local instance or MongoDB Atlas).

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mahmoud-atta1/Book-hub.git
   cd Book-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   NODE_ENV=development
   DB_URI=mongodb://127.0.0.1:27017/book_hub
   JWT_SECRET=replace-with-a-strong-secret
   JWT_EXPIRES_IN=7d
   ADMIN_EMAILS=admin@book-hub.local
   CORS_ORIGIN=http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000
   ```

   > 💡 **Tip:** Any email listed in `ADMIN_EMAILS` will automatically receive the Admin role upon registration.

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open in your browser**
   ```
   http://localhost:3000
   ```

---

## 📜 Available Scripts

```bash
npm run dev     # Start development server with auto-reload (nodemon)
npm start       # Start production server
npm run lint    # Lint backend code with ESLint
npm test        # Run Jest test suite
```

---

## 📡 API Reference

All endpoints are prefixed with `/api/v1`. Protected routes require a Bearer token in the `Authorization` header.

### 🔑 Authentication

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/auth/register` | Public | Register a new user |
| `POST` | `/auth/login` | Public | Login and receive JWT |
| `GET` | `/auth/me` | User | Get current user profile |

### 📚 Books (Catalog)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/books` | Public | List all books |
| `GET` | `/books/:id` | Public | Get a single book |
| `POST` | `/books` | Admin | Add a new book |
| `PUT` | `/books/:id` | Admin | Update book details |
| `DELETE` | `/books/:id` | Admin | Remove a book |
| `GET` | `/books/stats/overview` | Admin | Inventory statistics |

### 🧾 Transactions (Orders)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/transactions/purchase` | User | Place a purchase request |
| `GET` | `/transactions/my` | User | View personal order history |
| `GET` | `/transactions` | Admin | View all transactions |
| `GET` | `/transactions/stats/overview` | Admin | Sales statistics |
| `PATCH` | `/transactions/:id/status` | Admin | Update order status |
| `PATCH` | `/transactions/:id/approve` | Admin | Approve an order |
| `PATCH` | `/transactions/:id/reject` | Admin | Reject an order |

### 🔄 Order Flow

```
User places order
      │
      ▼
  [pending]  ──── Admin rejects ────► [rejected]
      │
      ▼
 Admin approves
      │
      ▼
 [in_transit]  ◄── Stock is deducted here
      │
      ▼
 [completed]
```

> When placing an order, users provide: `customerName`, `customerPhone`, `customerAddress`, and optionally `customerNotes`.

---

## 📁 Project Structure

```
Book-hub/
├── backend/
│   ├── controllers/       # Route handler logic
│   ├── models/            # Mongoose schemas
│   ├── routes/            # Express route definitions
│   ├── middleware/        # Auth, error handling, etc.
│   └── app.js             # Server entry point
├── frontend/
│   ├── *.html             # App pages
│   ├── css/               # Stylesheets
│   └── js/                # Client-side scripts
├── .eslintrc.json
├── .gitignore
├── package.json
└── README.md
```

---

## 🔒 Security

- Passwords are hashed using **bcryptjs**
- Routes are protected via **JWT middleware**
- HTTP headers secured with **Helmet**
- Input sanitized and validated with **express-validator**
- Admin access is gated by a whitelist of emails (`ADMIN_EMAILS`)


---

<div align="center">

Made with ❤️ by [mahmoud-atta1](https://github.com/mahmoud-atta1)

</div>
