# Project Context

## Purpose
Household Panel is an internal Next.js web application for coordinating TV-measurement household contact, appointment scheduling, and installation follow-up. The repository implements a browser dashboard backed by Supabase Auth and Postgres.

## User-facing workflow observed in code
1. Root route (`app/page.tsx`) redirects to `/login`.
2. Login accepts an email ending in `@inditronics.com` and authenticates with Supabase password auth.
3. Authenticated users enter `/dashboard`; the dashboard queries household data and role information.
4. Call Center users record a call outcome. When the call outcome is `call successful`, they can set `appointment_call_status` to `Scheduled` or `Rejected`.
5. Scheduled households can have multiple appointment entries in `household_appointments`.
6. Field Executives update `installation_status`; the table UI hides/limits fields by role.
7. Administrators can create accounts, assign application roles, and delete accounts.

## Roles found in the repository
The UI/admin API role list is `data_team`, `call_center`, `field_executive`, `developer`, and `admin`. The household update API specifically permits `call_center` and `field_executive`; user management requires `admin`. Exact permissions for `data_team` and `developer` beyond UI/read behavior are not fully established by this repository snapshot.

## Repository boundaries
- Frontend and server routes: Next.js App Router under `app/`.
- Supabase client helpers: `src/lib/supabase/`.
- Shared UI: `components/`, with utility hooks in `hooks/` and `lib/`.
- No database migration files, SQL schema dump, test suite, or CI/deployment manifest were present in the supplied archive. Therefore the live database schema and provider-side policies cannot be independently confirmed here.

## Documentation index
- [Technical architecture](TECHNICAL_ARCHITECTURE.md)
- [Database schema](DATABASE_SCHEMA.md)
- [Implementation status](IMPLEMENTATION_STATUS.md)
- [API documentation](API_DOCUMENTATION.md)
- [Codebase guide](CODEBASE_GUIDE.md)
- [Decisions and known issues](DECISIONS_AND_KNOWN_ISSUES.md)

## Accuracy conventions
“Implemented” means code exists in this archive. “Tested” requires test evidence; no automated tests were found in the supplied repository. “Production-verified” requires deployment/runtime evidence, which is unavailable in this archive.
