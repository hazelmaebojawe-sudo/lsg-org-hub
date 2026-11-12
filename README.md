# LSG Org Hub

> Local Student Government & Organization Management System
> IT 109 – System Integration and Architecture, Final Project (1st Sem, 2025-2026)
> Caraga State University – College of Computing and Information Sciences

## Description

An organization management hub categorized by college. It allows the Local Student Government (LSG) and college organizations to process memberships, post announcements, and collect semestral fees and dues online.

**User roles**

| Role | What they can do |
|---|---|
| Student Member | Register and select a college, view the LSG and organizations of that college, apply for membership, pay LSG fees and org dues online, download receipts |
| Org Officer | Manage the organization's membership list, verify requirements, post announcements, view dues summaries |
| LSG Admin | Manage organizations in the college, collect LSG dues, audit sub-organizations, issue or revoke college clearance |

**Main transaction flow**

1. Student registers and selects a college
2. Student applies for membership and uploads requirements, Org Officer verifies (`Verified`)
3. Student pays via PayMongo, the webhook marks it `Paid`, and a receipt is emailed
4. LSG Admin reviews payments and issues the final clearance (`Cleared`)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (TypeScript), Tailwind CSS, Shadcn UI |
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL (Supabase) |
| Caching | Redis (Upstash Free Tier) / NestJS Cache Manager |
| Object Storage | _TODO: Cloudinary / Supabase Storage / MinIO_ |

**Third-party integrations:** Google OAuth 2.0, PayMongo Sandbox, PSGC Address API, Google SMTP, Object Storage, CAPTCHA (_TODO: choose one_)

## Prerequisites

- Node.js _TODO: version, e.g. 20 LTS or newer_ (check with `node -v`)
- npm (comes with Node.js)
- Git
- Accounts (free tier / test mode only): GitHub, Supabase, Google Cloud Console, PayMongo, Gmail (with App Password), Upstash (optional), object storage provider, CAPTCHA provider
- ngrok or Cloudflare Tunnel (to receive PayMongo webhooks locally)

## Setup Steps

### 1. Clone the repository

```bash
git clone https://github.com/<owner>/lsg-org-hub.git
cd lsg-org-hub
```

### 2. Install dependencies

```bash
cd backend
npm install
cd ../frontend
npm install
```

### 3. Create environment files

Copy the example files and fill in your own values (never commit the real files).

**Windows (PowerShell)**

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

**Mac / Linux / Git Bash**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### 4. Set up the database

_TODO: add migration / seed commands once the schema is ready._

### 5. Run the apps

Open two terminals.

```bash
# Terminal 1 - backend (http://localhost:3001)
cd backend
npm run start:dev
```

```bash
# Terminal 2 - frontend (http://localhost:3000)
cd frontend
npm run dev
```

### 6. Webhooks (PayMongo)

_TODO: document the ngrok command and the webhook URL to register in the PayMongo dashboard._

## Environment Variables

Names only. Never put real values in this file or in the repository.

**`backend/.env`**

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default 3001) |
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Google OAuth redirect URI |
| `JWT_SECRET` | Secret for signing session tokens |
| `PAYMONGO_SECRET_KEY` | PayMongo test-mode secret key |
| `PAYMONGO_WEBHOOK_SECRET` | PayMongo webhook signing secret |
| `SMTP_USER` | Gmail address used for sending email |
| `SMTP_APP_PASSWORD` | Gmail App Password |
| `CAPTCHA_SECRET_KEY` | CAPTCHA secret key (verified on the backend) |
| `FRONTEND_URL` | Frontend base URL (default http://localhost:3000) |

_Add any new variables here (Redis, object storage keys, etc.) as they are introduced._

**`frontend/.env.local`**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (default http://localhost:3001) |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY` | CAPTCHA public site key |

## Project Structure 

```
lsg-org-hub/
├── frontend/   # Next.js app
├── backend/    # NestJS API
├── docs/       # Diagrams and documentation PDF
└── README.md   # this file,,
```

## Git Workflow

- `main` holds only working code
- Work in feature branches (e.g. `feature/google-auth`, `feature/paymongo`)
- Merge through Pull Requests
- Never commit `.env` files or secrets

## Team Members

Bojawe, Hazel Mae P.
Ayuban, Charriel Mae M. 
