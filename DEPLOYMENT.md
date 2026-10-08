# FinanceFlow deployment guide

This guide describes a Vercel frontend, Render FastAPI service, and Render PostgreSQL database. Configure the frontend and backend as separate services. Do not put database credentials or the JWT signing key in the frontend environment.

## 1. Render PostgreSQL

1. Create a Render PostgreSQL instance in the same region as the backend service.
2. Set its database name to exactly `FinanceFlow_db`; the backend refuses any other database name.
3. Use the **internal** connection URL from the Render database dashboard for the backend's `DATABASE_URL`. Keep it in Render's environment settings, not in source control. The installed `psycopg2-binary` driver supports the Render PostgreSQL URL; SQLAlchemy reads the database name from the URL and validates it before creating an engine.
4. Prefer the internal URL for same-region service traffic. If an external URL is used, follow Render's TLS requirements and preserve its SSL query parameters.

The backend does not create tables at application startup. On a new, empty `FinanceFlow_db`, review `backend/migrations.py` and run `python backend/create_tables.py` once from the repository root. That script creates the tables and applies the project's compatibility updates; it is a separate, write operation and should not be configured as a recurring startup command. Back up and review any existing database before running it. This project has no migration runner or rollback workflow.

## 2. Render FastAPI service

Create a Web Service from the repository root with Python as the runtime. Set:

- **Build command:** `pip install -r backend/requirements.txt`
- **Start command:** `uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT`
- **Health check path:** `/health`

Configure these backend environment variables in Render:

| Variable | Required value |
| --- | --- |
| `APP_ENV` | `production` (enables production startup checks) |
| `DATABASE_URL` | Render PostgreSQL connection URL whose database name is `FinanceFlow_db` |
| `AUTH_SECRET_KEY` | A unique random value of at least 32 characters; generate it locally with `python -c "import secrets; print(secrets.token_urlsafe(48))"` and paste it directly into Render's secret environment setting |
| `AUTH_TOKEN_TTL_MINUTES` | Optional; defaults to `30`, permitted range `1`–`1440` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins for the production frontend, e.g. `https://<your-vercel-domain>`; no wildcard and no path suffix |

Production startup fails when the database, a sufficiently long JWT key, or explicit CORS origins are missing. CORS allows only the configured origins. The Vercel frontend calls the backend from its server-side proxy, so browser requests remain same-origin with Vercel; the backend origin is never embedded in client JavaScript.

## 3. First ADMIN account

Public `POST /auth/register` always creates an `ANALYST`. There is no public ADMIN registration route.

After the production database schema exists and the backend environment is configured, open the Render service's private Shell and run `python backend/bootstrap_admin.py`. Enter the administrator email and password at the interactive prompts; the password is read with `getpass`, hashed by the existing user service, and is not passed as a shell argument. The script refuses databases other than `FinanceFlow_db` and refuses to create another active ADMIN. Do not put the password in a command, dashboard log, file, or this repository.

## 4. Vercel frontend

Import the repository into Vercel and set **Root Directory** to `frontend`. Vercel detects the Next.js framework and uses the existing `frontend/package.json` scripts and `frontend/next.config.ts`; no custom output directory or `vercel.json` is required.

Set these Vercel environment variables:

| Variable | Required value |
| --- | --- |
| `FINANCEFLOW_API_BASE_URL` | The HTTPS public URL of the Render backend service, without a trailing slash |
| `AUTH_COOKIE_SECURE` | `true` in Production (the code also forces Secure cookies whenever `NODE_ENV=production`) |

Set the backend's `CORS_ALLOWED_ORIGINS` to the exact Vercel Production domain(s) used by the app. Add a Preview domain only if that preview is intentionally allowed to call the production API. Do not use a `NEXT_PUBLIC_` prefix for backend URLs or secrets. Production proxy routes return 503 when `FINANCEFLOW_API_BASE_URL` is missing instead of falling back to localhost.

The browser-facing JWT cookie is HTTP-only, Secure in production, `SameSite=Lax`, and scoped to `/`. The cookie is host-only (no `Domain` attribute); the browser talks to Vercel's same-origin `/api` routes while the Vercel server forwards authenticated requests to Render. This avoids cross-site cookie requirements between Vercel and Render.

## 5. Local environment and commands

- Copy root `.env.example` to `.env` for local backend development. Keep private values only in `.env`.
- Copy `frontend/.env.example` to `frontend/.env.local` for local frontend development. These files are ignored by Git; the examples contain placeholders/local URLs only.
- Local CORS defaults to `localhost` and `127.0.0.1` on ports 3000 and 3001. Override `CORS_ALLOWED_ORIGINS` when using other local origins.
- Backend local start: `uvicorn main:app --app-dir backend --reload` from the repository root.
- Frontend local start: `cd frontend; npm ci; npm run dev`.
- Frontend checks: `npm run lint`, `npm run typecheck`, `npm run build` from `frontend`.
- Backend test setup: `pip install -r backend/requirements-test.txt` (includes the test-only HTTP client omitted from production dependencies).
- Backend tests: `python -m pytest -q` from the repository root when pytest is installed. The checked-in tests are also unittest-compatible: `python -m unittest discover -s tests`.

## 6. Post-deployment verification

1. Request `GET /health` and `GET /health/db` on the Render service; both should return success.
2. From the Vercel origin, register an Analyst and log in. Confirm browser storage shows an HTTP-only, Secure `financeflow_token` cookie and no JWT in page JavaScript.
3. Confirm authenticated Dashboard, Transactions, Exceptions, and Audit Logs load through the Vercel `/api` proxy; confirm unauthenticated requests redirect or return 401.
4. Confirm an Analyst receives 403 from an ADMIN-only API route; use the privately bootstrapped ADMIN to verify allowed user/configuration operations.
5. Resolve a designated test exception with a reason and confirm its status-change event appears in Audit Logs.
6. Confirm the production frontend origin is allowed and an unrelated origin is rejected by the backend CORS middleware.
7. Check Render and Vercel logs for startup errors without copying secrets into tickets or chat.

## 7. Dependency security notes

Run `npm audit` against the current lockfile before every production release. On 2026-10-09, after updating Next.js to the patched 15.5.27 maintenance release, the full dependency tree reported 29 findings (1 critical, 20 high, 6 moderate, 2 low). `npm audit --omit=dev` reported 6 findings in the production dependency graph (0 critical, 4 high, 2 moderate): high findings in `postcss`, `nanoid`, `sharp`, and `source-map-js`, and moderate findings associated with `next` and `mdast-util-to-hast`. The remaining critical `tar` finding is in the full tree but not in the production-only audit. Treat these findings as release blockers until each is patched or reviewed against the actual reachable code paths. Do not use a blanket audit fix or a major Next.js upgrade; check patched versions and compatibility individually.

The Python runtime requirements are not pinned, and `pip-audit` is not installed in the current environment. Perform a Python dependency advisory review and establish a reviewed production lock/constraints set before deployment. `httpx2` is used only by API tests and is kept in `backend/requirements-test.txt`, outside the Render runtime install.
