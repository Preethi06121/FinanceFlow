# FinanceFlow frontend

The FinanceFlow frontend is adapted from the [Mainline Next.js template](https://github.com/shadcnblocks/mainline-nextjs-template) and uses its Next.js App Router setup, Tailwind 4 theme, DM Sans font, shadcn/ui building blocks and light/dark theme support.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `FINANCEFLOW_API_BASE_URL` to the FastAPI server URL. The default assumes FastAPI is running at `http://127.0.0.1:8000`.
3. Set `AUTH_COOKIE_SECURE=true` when the frontend is served over HTTPS. Keep it `false` for local HTTP development.
4. Install and start the frontend:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The Next.js server proxies authenticated API calls to FastAPI. JWTs are stored in HTTP-only cookies and are not exposed to browser JavaScript.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

Use a FinanceFlow administrator account to sign in. Users are managed through the admin area after login.
