# Codebase Guide

## Directory map

```text
app/
  page.tsx                              Root redirect
  login/page.tsx                        Sign-in form
  dashboard/
    layout.tsx                          Dashboard shell/authorization
    page.tsx                            Dashboard overview/data queries
    users/page.tsx                      Admin-only user-management page
    users/users-management.tsx          Client-side admin user workflows
  api/
    admin/users/route.ts                List/create users
    admin/users/[userId]/route.ts       Change role/delete user
    households/[id]/route.ts            Role-specific household PATCH
    households/[id]/appointments/
      route.ts                          List/create appointments
      [appointmentId]/route.ts          Delete appointment
components/
  household-table.tsx                   Household grid and workflow controls
  app-sidebar.tsx                       Navigation shell
  ui/                                   Reusable UI primitives
src/lib/supabase/
  client.ts                             Browser Supabase client
  server.ts                             Cookie-aware server client
  admin.ts                              Server-only privileged client
  require-admin.ts                      Admin authorization helper
hooks/use-mobile.ts                     Responsive breakpoint hook
lib/utils.ts                            Shared class utility export
```

## Key responsibilities
- `app/login/page.tsx`: client-side form validation and password login; redirects to dashboard on success.
- `app/dashboard/page.tsx`: dashboard summary and household query logic. Inspect this file alongside the table component for actual visible metrics and query projections.
- `components/household-table.tsx`: role-sensitive columns, local draft state, sequential row unlock/save behavior, status selectors, appointment list/add/delete controls, and installation status display/editing.
- `app/api/households/[id]/route.ts`: server-side authorization and validation for role-specific household updates.
- `app/api/households/[id]/appointments/route.ts`: appointment reads and creation.
- `app/api/households/[id]/appointments/[appointmentId]/route.ts`: appointment deletion.
- `app/api/admin/users/route.ts`: privileged account listing and creation.
- `app/api/admin/users/[userId]/route.ts`: privileged role update and account deletion.
- `src/lib/supabase/server.ts`: bridges Supabase auth cookies with Next.js `cookies()`.
- `src/lib/supabase/admin.ts`: initializes privileged client using server environment variables; must remain server-only.
- `src/lib/supabase/require-admin.ts`: central admin gate for admin API handlers.

## Main workflow in the table
1. Household records are loaded by the dashboard.
2. The table maintains editable drafts and uses row-level status logic to enable controls.
3. Call Center can save the call outcome; appointment status becomes available only after successful call.
4. Scheduled appointments are fetched and shown chronologically; Call Center can add future times and delete entries.
5. Appointment rejection makes scheduling and installation areas inaccessible in the UI.
6. Field Executive can edit installation status and save through the household PATCH route.
7. The API repeats key role/status validations; do not rely on client-only disabled controls.

## Package scripts
- `npm run dev` — Next.js development server.
- `npm run build` — production build.
- `npm start` — production server.
- `npm run lint` — ESLint.
No `test` script is defined.

## Configuration files
- `next.config.ts`: enables `cacheComponents`, `partialPrefetching`, `experimental.agentFeedback`, and CSS loading through Tailwind Turbopack.
- `tsconfig.json`: strict TypeScript, bundler module resolution, `@/*` path alias.
- `eslint.config.mjs`: Next.js Core Web Vitals and TypeScript rules.
- `components.json`: UI generator configuration.
