# ClinicStock

ClinicStock is an inventory management application for small clinics. It helps
teams manage supplies and stock activity. It is not a patient-records system.

## Features

- Admin and Staff sign-in.
- Role-based access to operational pages and master data.
- Dashboard with stock summaries and low-stock indicators.
- Category, supplier, and item management.
- Stock In and Stock Out recorded through the `record_stock_movement()` RPC.
- Stock History and Reports.
- Validation that new or changed item category and supplier relations are active.

Staff can read operational data and record Stock In and Stock Out through the
RPC, subject to its business validation. Admins manage categories, suppliers,
and items.

## Technology

- React and JavaScript.
- Vite.
- React Router.
- Supabase Auth and PostgreSQL with Row Level Security (RLS) and RPC.

## Prerequisites

- Node.js and npm.
- Access to a Supabase project configured for ClinicStock.

The project does not declare a specific Node.js version.

## Local setup

Install dependencies:

```sh
npm install
```

Create a local `.env.local` file with the following variable names:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Set these values using the configuration for your Supabase project. Do not put
a service-role key or other secret in frontend environment variables or commit
secret values.

## Supabase database setup

Apply the migrations in timestamp order using the database workflow approved
for your project:

1. [`20261116061900_clinicstock_schema.sql`](supabase/migrations/20261116061900_clinicstock_schema.sql)
2. [`20261117104127_add_supplier_notes.sql`](supabase/migrations/20261117104127_add_supplier_notes.sql)
3. [`20261117151500_validate_item_active_relations.sql`](supabase/migrations/20261117151500_validate_item_active_relations.sql)

The first migration defines the core schema, RLS policies, grants, triggers,
and stock-movement RPC. The second adds `suppliers.notes`. The third validates
active category and supplier relations on item inserts and relation changes.

Having migration files in the repository does not prove that they have been
applied to a particular Supabase project. Verify the target database before
relying on its schema or security configuration.

New authentication profiles are created with the Staff role by a database
trigger. Accounts need an active Admin or Staff profile to access the
application. Admin provisioning must follow an authorized project
administration process.

## Run and build

Start the development server:

```sh
npm run dev
```

Create a production build:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

On Windows PowerShell, use `npm.cmd` if required by the local shell, for
example `npm.cmd run dev`.

The available npm scripts are `dev`, `build`, and `preview`. No test or lint
script is currently defined in `package.json`.

## Project structure

- `src/App.jsx` — application providers and routes.
- `src/context/` — authentication context and legacy inventory context.
- `src/components/` — shared layout and UI components.
- `src/pages/` — login and operational pages.
- `src/lib/supabaseClient.js` — shared Supabase client.
- `src/services/supabaseInventoryRepository.js` — Supabase data operations.
- `src/services/supabaseInventoryMapper.js` — validation and data mapping.
- `src/services/localStorageRepository.js` and `src/data/seedData.js` — legacy
  local-storage and seed-data implementation.
- `supabase/migrations/` — database migrations.

Operational pages use the Supabase repository for their data. Legacy
local-storage and seed-data code remains in the project; the application
provider still initializes that local data, but it is not the active data
source for the operational pages.

## Verification status

The following status reflects the project checks reported for this stage:

- Production build: **successful**.
- Production preview: **opened successfully in Chrome**.
- Admin login: **successful**.
- Staff login: **successful**.
- Eight operational pages were manually checked for Admin and Staff.
- Database metadata was inspected using read-only queries.
- Runtime RLS security testing: **not performed**.
- Concurrent stock-movement testing: **not performed**.
- Vite still reports a JavaScript bundle-size warning; the reported bundle is
  **573.32 kB**.

Browser checks were manual smoke tests, not comprehensive automated testing.
Build, login, page checks, and metadata inspection do not prove that every
feature or all database security behavior has passed testing. In particular,
metadata inspection is not a runtime test of RLS policies, and migration files
do not establish that the migrations are applied to every target project.
