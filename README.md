# The Pigsty - Smart Farm Management Platform

A full-stack pig farm management platform for tracking animals from birth to sale, managing distributed teams, generating reports, and monitoring farm health remotely.

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite, Tailwind CSS v4, TanStack Query, Recharts, React Hook Form + Zod
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Reports**: PDFKit (PDF), SheetJS (Excel)
- **PWA**: vite-plugin-pwa with service worker

## Features (Phase 1 MVP)

- Email/password authentication with JWT + refresh tokens
- Google OAuth support
- Role-based access control (Owner, Farm Manager, Veterinarian, Supervisor, Worker, Auditor)
- Multi-farm management with per-farm dashboards
- Complete pig lifecycle management (birth/acquisition to sale)
- Bulk pig import via Excel template (up to 5,000 records)
- Weight tracking with growth monitoring and ADG calculation
- Pen/facility management with occupancy tracking
- Reports: Herd Inventory, Weight Gain, Activity Log, Daily Summary (PDF/Excel)
- Immutable audit logging
- PWA support for mobile access

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (via Postgres.app or other installation)

## Getting Started

### 1. Database Setup

```bash
createdb pigtrack_pro
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL connection string
npm install
npx prisma migrate dev
npm run dev
```

The API server starts at `http://localhost:4000`.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app is available at `http://localhost:5173`.

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/google` - Google OAuth
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Current user profile

### Farms
- `POST /api/farms` - Create farm
- `GET /api/farms` - List user's farms
- `GET /api/farms/:farmId` - Farm detail + dashboard stats
- `PATCH /api/farms/:farmId` - Update farm
- `DELETE /api/farms/:farmId` - Delete farm
- `POST /api/farms/:farmId/invite` - Invite member
- `DELETE /api/farms/:farmId/members/:id` - Remove member

### Pigs
- `GET /api/farms/:farmId/pigs` - List pigs (with search, filter, pagination)
- `POST /api/farms/:farmId/pigs` - Create pig
- `GET /api/farms/:farmId/pigs/:pigId` - Pig detail with full history
- `PATCH /api/farms/:farmId/pigs/:pigId` - Update pig
- `DELETE /api/farms/:farmId/pigs/:pigId` - Delete pig

### Import
- `GET /api/farms/:farmId/pigs/import/template` - Download Excel template
- `POST /api/farms/:farmId/pigs/import` - Validate uploaded file
- `POST /api/farms/:farmId/pigs/import/confirm` - Confirm import

### Pens
- `GET /api/farms/:farmId/pens` - List pens
- `POST /api/farms/:farmId/pens` - Create pen
- `PATCH /api/farms/:farmId/pens/:penId` - Update pen
- `DELETE /api/farms/:farmId/pens/:penId` - Delete pen

### Weights
- `POST /api/farms/:farmId/weights` - Log weight
- `POST /api/farms/:farmId/weights/bulk` - Bulk log by pen
- `GET /api/farms/:farmId/weights` - Recent weight logs
- `GET /api/farms/:farmId/pigs/:pigId/weights` - Pig weight history

### Reports
- `GET /api/farms/:farmId/reports/herd-inventory?format=pdf|xlsx|json`
- `GET /api/farms/:farmId/reports/weight-gain?format=pdf|xlsx|json`
- `GET /api/farms/:farmId/reports/activity-log?format=xlsx|json`
- `GET /api/farms/:farmId/reports/daily-summary?format=pdf|json`

## Role Permissions

| Permission | Owner | Manager | Vet | Supervisor | Worker | Auditor |
|---|---|---|---|---|---|---|
| Pig Records (CRUD) | Full | Full | Health | View | Feed/Daily | View |
| Reports | Full+Export | Full+Export | Health | View | - | View+Export |
| User Management | All | Workers | - | - | - | - |
| Farm Settings | Full | Full | - | - | - | - |
