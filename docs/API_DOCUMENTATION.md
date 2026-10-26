# API Documentation

All paths are Next.js App Router route handlers. Responses are JSON unless otherwise noted. Route params are awaited as promises, matching the Next.js version conventions used by this code. Authentication is based on the Supabase cookie session.

## Error conventions
Common responses include `{ "error": "..." }`. Status codes observed: 400 invalid input/workflow, 401 unauthenticated, 403 unauthorized role/domain, 404 missing record, 500 server/database error. Exact provider errors can sometimes be returned by admin endpoints.

## `GET /api/admin/users`
**Access:** `admin` via `requireAdmin()`.
**Success:** `{ "users": [{ "id": string, "email": string|null, "created_at": string|null, "role": string|null }] }`.
Lists Supabase Auth users in pages of up to 1000, fetches `user_roles`, and merges roles by user ID.

## `POST /api/admin/users`
**Access:** `admin`.
**Request:**
```json
{ "email": "user@inditronics.com", "password": "at-least-8-characters", "role": "data_team" }
```
Email is trimmed/lowercased, checked for basic email shape, restricted to `@inditronics.com`; password minimum is 8 characters; role must be one of `data_team`, `call_center`, `field_executive`, `developer`, `admin`. Creates a confirmed Supabase Auth user, then inserts `user_roles`. If role insertion fails, attempts to delete the created Auth user.
**Success:** created user information is returned (inspect route for exact response shape).

## `PATCH /api/admin/users/:userId`
**Access:** `admin`.
**Request:** `{ "role": "<allowed role>" }`.
Updates existing `user_roles` record or inserts one if missing. Code protects against some role changes; inspect `app/api/admin/users/[userId]/route.ts` for the exact guard conditions and response. Errors return JSON.

## `DELETE /api/admin/users/:userId`
**Access:** `admin`.
Deletes a Supabase Auth user after checking the target exists and preventing self-deletion. The route also inspects the target role; verify the remaining role-protection conditions in `app/api/admin/users/[userId]/route.ts` before relying on deletion behavior. Household rows are not directly deleted by this handler.

## `PATCH /api/households/:id`
**Access:** authenticated `@inditronics.com` user with role `call_center` or `field_executive`.
**Request:** JSON object. Fields permitted depend on role:
- `call_center`: call status and appointment call status, validated against the enumerated allowed values and workflow state.
- `field_executive`: `installation_status` only, validated as `pending`, `installed`, or `rejected`.
The handler loads the existing household record before updating. See `app/api/households/[id]/route.ts` for exact workflow transition rules and update columns.
**Success:** JSON success response. Exact shape should be confirmed from route source when integrating clients.

## `GET /api/households/:id/appointments`
**Access:** authenticated company-domain user.
**Success:** `{ "appointments": [{ "id": string, "scheduled_at": string, "created_by": string, "created_at": string }] }`.
Reads appointment rows for `household_record_id = :id`, ordered by `scheduled_at` ascending.

## `POST /api/households/:id/appointments`
**Access:** authenticated company-domain `call_center`.
**Request:**
```json
{ "scheduled_at": "2026-11-05T10:30:00+05:30" }
```
Validates a non-empty parseable date/time, checks that the household exists and `appointment_call_status === "Scheduled"`, then inserts the appointment with `created_by` set to the current user ID.
**Success:** appointment data is returned; exact shape is defined in `app/api/households/[id]/appointments/route.ts`.

## `DELETE /api/households/:id/appointments/:appointmentId`
**Access:** authenticated company-domain `call_center`.
Deletes by appointment ID and returns `{ "message": "Appointment deleted successfully." }` on success.

## Operational cautions
- Appointment GET checks authentication and email domain but not a specific application role.
- Appointment DELETE filters only by appointment ID after role validation; it does not visibly constrain the delete by the household `:id` parameter.
- Confirm all route handlers enforce intended cross-household access rules and that RLS/policies provide defense in depth.
- There is no OpenAPI specification or API test suite in the supplied archive.
