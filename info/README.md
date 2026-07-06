# Akisto Client Portal - Backend Implementation Context

## Project Overview

Akisto is an AI-powered procurement follow-up platform that tracks Purchase Orders (POs), supplier communications, delivery commitments, risks, delays, and follow-up actions.

The frontend has already been migrated to React and is functioning correctly. The objective is to add a backend layer without changing any existing frontend behavior, UI, UX, workflows, business logic, or user experience.

The backend must preserve 100% compatibility with the current frontend.

---

# Architecture

Current Architecture:

React Frontend
→ Google Apps Script API
→ Google Sheets

Target Architecture:

React Frontend
→ Node.js + Express Backend
→ Google Sheets
→ n8n Workflows

The backend becomes the single source of API access.

The frontend must never communicate directly with Google Sheets.

---

# Source of Truth

Google Sheets remains the ONLY database.

Do NOT introduce:

* PostgreSQL
* MySQL
* MongoDB
* Supabase
* Firebase

All data must continue to come from Google Sheets.

---

# Existing Business Domain

The system manages procurement follow-ups.

Primary entity:

comms_group_id

A comms_group_id represents a grouped PO communication thread and is the primary identifier used throughout the system.

---

# Main Data Areas

## Dashboard

Displays:

* KPI summary cards
* PO tracking table
* Supplier status
* Delivery status
* Risk indicators
* Next touch points

Current frontend expects dashboard data exactly as it receives it today.

Do not change response structures.

---

## PO Detail View

Route:

/po/

Displays:

* Header information
* Supplier information
* Material information
* Delivery dates
* Communication timeline
* Stage history
* Supplier replies
* Escalations
* Next actions

Current React implementation already expects specific JSON structures.

Backend must preserve those structures.

---

## Authentication

Current login flow:

Step 1:
Company selection

Step 2:
Email + Password

Authentication must support:

* client_code
* email
* password
* role
* active status

Backend should issue JWT tokens.

Frontend behavior must remain unchanged.

---

# Multi-Tenant Requirements

System supports multiple clients.

Examples:

* Biotique
* Emerald
* Future Clients

Every user belongs to a single:

client_code

Users must only access data belonging to their client_code.

All filtering must happen server-side.

Frontend should never receive unauthorized data.

---

# Existing React Frontend Expectations

Current frontend uses:

localStorage:

* sessionToken
* userEmail
* companyName

The frontend currently redirects users to login when authentication fails.

Maintain this behavior.

---

# Core API Areas

Backend should expose:

## Authentication

POST /api/auth/login

GET /api/auth/me

POST /api/auth/logout

---

## Dashboard

GET /api/dashboard

GET /api/dashboard/summary

---

## PO Details

GET /api/po/

---

## Suppliers

GET /api/supplier/

---

# Google Sheets

Google Sheets remains the operational database.

Backend is responsible for:

* Reading sheets
* Filtering rows
* Aggregating records
* Calculating KPIs
* Formatting API responses
* Security enforcement

Frontend should never access Sheets directly.

---

# n8n Integration

n8n remains responsible for:

* Supplier follow-up workflows
* Email processing
* AI classification
* Escalation workflows
* Communication logs
* PO status updates

Backend must not replace n8n.

Backend only consumes and exposes data.

---

# Caching

Backend should introduce caching.

Goals:

* Reduce Google Sheets requests
* Improve dashboard load speed
* Improve mobile performance
* Reduce reload latency

Recommended:

node-cache

Do not introduce Redis unless absolutely required.

---

# Required Backend Stack

Node.js

Express.js

googleapis

jsonwebtoken

bcrypt

node-cache

dotenv

cors

---

# Recommended Backend Structure

backend/

src/

routes/

* auth.routes.js
* dashboard.routes.js
* po.routes.js
* supplier.routes.js

controllers/

* auth.controller.js
* dashboard.controller.js
* po.controller.js
* supplier.controller.js

services/

* sheets.service.js
* auth.service.js
* cache.service.js

middleware/

* auth.js
* clientFilter.js

config/

* google.js

server.js

---

# Critical Rules

1. Do NOT modify UI.
2. Do NOT modify UX.
3. Do NOT modify React routing.
4. Do NOT modify React components.
5. Do NOT change API response shapes expected by the frontend.
6. Do NOT change business logic.
7. Do NOT redesign architecture beyond adding the backend layer.
8. Preserve all existing functionality exactly.
9. Backend must act as a compatibility layer between React and Google Sheets.
10. Treat this as a zero-regression migration.

Success means:

The React frontend works exactly as it does today, except all data now comes through the Express backend instead of direct Apps Script calls.
