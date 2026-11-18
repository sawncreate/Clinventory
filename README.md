# ClinicStock

ClinicStock is a web application for managing operational inventory at small
clinics. It helps clinic teams organize supplies, monitor stock levels, and
review stock activity. It is not a patient-records system.

## Problem and solution

Clinic inventory can be difficult to track when item details, suppliers, and
stock changes are handled separately. ClinicStock brings these workflows into
one application: teams can maintain inventory records, record stock movements,
and review current stock and transaction history.

## Key features

- Dashboard with inventory totals, low-stock indicators, recent transactions,
  and a seven-day stock-movement overview.
- Item search by name, SKU, category, or supplier, with a category filter.
- Category and supplier management.
- Stock In and Stock Out transactions recorded through the
  `record_stock_movement()` Supabase RPC.
- Stock history and reports with date, item, and movement-type filters.
- Profile page displaying the signed-in user's name, email, and role.
- Responsive navigation and layouts for desktop and smaller screens.
- Validation of active category and supplier relations when items are created
  or those relations are changed.

## Admin and Staff roles

| Role | Capabilities |
| --- | --- |
| Admin | View operational pages; manage items, categories, and suppliers; record Stock In and Stock Out. |
| Staff | View operational pages and record Stock In and Stock Out. |

Page access is guarded by the user's active profile and role. Database access
also relies on the target Supabase project's grants and Row Level Security
(RLS) policies.

## Technology stack

- React 19 and React DOM.
- Vite 8 with the React plugin.
- React Router 7.
- Supabase JavaScript client 2 for authentication and data access.
- Supabase PostgreSQL, RLS, and RPC for inventory operations.
- CSS for application styling and responsive layouts.

## Project structure

```text
.
├── index.html
├── src/
│   ├── App.jsx
│   ├── components/       # Shared layout and UI components
│   ├── context/          # Authentication and inventory contexts
│   ├── data/             # Legacy seed data
│   ├── lib/              # Supabase client
│   ├── pages/            # Application pages
│   └── services/         # Supabase repositories and legacy inventory services
├── supabase/
│   └── migrations/       # Database schema and changes
├── vercel.json           # SPA route rewrite for Vercel
├── vite.config.js
├── package.json
└── package-lock.json
```

The operational pages use the Supabase inventory repository. The legacy
local-storage repository and seed data remain in the project, and the
`InventoryProvider` still initializes that local data; it is not the active
data source for the operational pages.

## Local development

### Prerequisites

- Node.js and npm. Vite 8 supports Node.js 20.19 or later in the 20.x line, or
  22.12 or later; Node.js 22.12 or later is a suitable choice.
- Access to a Supabase project configured for ClinicStock.

### Setup

1. Install the locked dependencies:

   ```sh
   npm ci
   ```

2. Create a root-level `.env.local` file and configure the required variable
   names listed below using your Supabase project configuration.
3. Start the development server:

   ```sh
   npm run dev
   ```

4. Create and preview a production build:

   ```sh
   npm run build
   npm run preview
   ```

In Windows PowerShell, use `npm.cmd` if required by the local shell.

## Environment variables

The Vite client reads these variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Vite exposes variables with the `VITE_` prefix to browser code. Use only the
Supabase URL and publishable key here. Never place a service-role key, password,
or other private credential in frontend environment variables or commit
environment values.

## Supabase setup

Apply the migrations in timestamp order using the database workflow approved
for the target project:

1. [`20261116061900_clinicstock_schema.sql`](supabase/migrations/20261116061900_clinicstock_schema.sql)
2. [`20261117104127_add_supplier_notes.sql`](supabase/migrations/20261117104127_add_supplier_notes.sql)
3. [`20261117151500_validate_item_active_relations.sql`](supabase/migrations/20261117151500_validate_item_active_relations.sql)

The first migration defines the core schema, access policies, triggers, and
stock-movement RPC. The later migrations add supplier notes and validate
active item relations. The presence of migration files does not confirm that
they have been applied to a particular Supabase project.

The application does not provide an in-app Sign Up flow. New accounts must be
provisioned through an authorized process. A database trigger creates a Staff
profile for a new authentication user; `full_name` is optional and is not
populated by that trigger.

## Deployment

The project is configured for Vercel as a Vite single-page application:

- Build command: `npm run build`
- Output directory: `dist`
- [`vercel.json`](vercel.json) rewrites application routes to `/index.html` so
  React Router routes can be opened directly.

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the
appropriate Vercel environment scopes. Verify that the target Supabase project
has the required migrations, access policies, and authentication configuration
before directing users to the deployment.

## Current limitations

- Account creation and profile editing are not available in the application.
  If a profile has no full name, the Profile page displays “Nama belum diatur”.
- Legacy local-storage and seed-data code remains initialized by the inventory
  context, although operational pages use Supabase.
- `package.json` defines `dev`, `build`, and `preview` scripts, but no
  automated test or lint script.
- Recent production builds have emitted a Vite warning for a minified
  JavaScript chunk larger than 500 kB.
- Runtime RLS behavior and concurrent stock-movement scenarios require
  separate validation; migration files alone do not verify those behaviors in
  a deployed project.
