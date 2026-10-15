# AI Tool & Vendor Registry

A web-based intake and risk register for AI tools and vendors. Employees or product teams submit a new AI tool, and a Python function assigns a risk tier (Low, Medium, High, Critical) and returns the security and compliance review controls required for that tier.

**Stack:** React (Vite), Python serverless function on Vercel.

## How tiering works

`api/tier.py` scores each submission on:

- Sensitivity of data handled (public, internal, PII, financial, health, credentials)
- Involvement of customer data
- Whether the vendor may train models on company data
- Availability of an independent assurance report (SOC 2, ISO 27001)
- Level of access to internal systems
- Whether outputs feed decisions without required human review
- Breadth of use (individual, team, organization)

Score bands map to tiers, and each tier returns a list of review controls (security questionnaire, privacy review, data-processing agreement, Legal and Security sign-off, review cadence).

## Current status

Working demo. Entries are stored in the browser only.

**Planned:** user logins, shared database, email notifications, and review workflow assignments.

## Run locally

```
npm install
npm run build
npx vercel dev
```

`vercel dev` is needed locally so the Python function at `/api/tier` runs alongside the frontend.

## Deploy

Import the repository into Vercel. It detects Vite and the Python function automatically.
