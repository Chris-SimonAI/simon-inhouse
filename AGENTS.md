## Stack Defaults

* **Frontend:** Next.js (App Router) + Tailwind. **RSC-first**; use Client Components only when interactivity is required.
* **Backend:** Next.js **Server Actions** (annotate `'use server'`).
* **Auth:** Better Auth.
* **DB:** Postgres (RDS) via **Drizzle**.
* **Validation:** **Zod** + **drizzle-zod** (schema-derived).
* **Pkg/Runtime:** **npm** only; Node 24 LTS.

## Conventions

* **TypeScript:** `"strict": true`; **no default exports**; path alias `@/*`.
* **Env:** Validate once at startup (single `src/env.ts`); never read `process.env.*` in client code (use `server-only` where needed).
* **Data Flow:** All DB and secret-bearing calls are **server-only**. Validate all **external input** at the edge of a Server Action or Route Handler (Zod).
* **MCP:** Use **context7**. Add use context7 to prompts where needed. Example: Create a Next.js middleware that checks for a valid JWT in cookies and redirects unauthenticated users to `/login`. use context7
* **Runtime:** Any DB-touching Route Handler or file must export `export const runtime = "nodejs"`.
* **Errors:** Never leak secrets; return typed result envelopes `{ ok: boolean; data?; message? }`.

## Project Structure

```
__tests__
src/
  app/            # routes, RSC-first; route handlers colocated
  components/     # colocated components; client-only when required
    ui/           # reusable, pure UI building blocks
  constants/
  db/             # drizzle schema + migrations
  hooks/
  lib/            # server utilities, MCP wrappers, auth helpers
  scripts/        # one-off scripts; no app imports
  svgs/
  validations/    # zod & drizzle-zod schemas
```

## Env Validation (pattern)

```ts
// src/env.ts
import "server-only";
import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enu
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  APP_API_KEY: z.string().url()
});

export const env = Env.parse(process.env);
```

**Rule:** Only import from `src/env.ts` on the server. In client code, pass necessary `NEXT_PUBLIC_*` via props or `headers()`.

## Drizzle + drizzle-zod

* **Single source of truth:** `src/db/schema.ts`. Generate & run migrations via npm scripts only.
* **Example custom rule:**

```ts
export const ReservationInsert = createInsertSchema(reservations, {
  roomNumber: (s) => s.regex(/^[A-Z]?\-?\d{1,4}$/),
});
```

## Server Actions (Guardrails)

* Always annotate `'use server'`.
* Validate `payload: unknown` with Zod right away.
* Return typed results; **no secrets in errors**.
* After writes: **revalidate** affected caches (see Caching section).

## Auth (Better Auth)

* Do session checks on the **server**; pass minimal session down via props or `headers()`.
* Keep role/perm helpers in `src/lib/auth.ts`. See `/docs/auth.md`.

## Testing

* Tests must pass using `npm run test`
* Vitest is used for unit tests and React Testing Library is used for DOM Testing.
* All tests must be written in `__tests__` folder.


## Quality Gates

* CI must pass `npm run lint && npm run test` before merge.

## Commit Emoji (subject prefix)

`✨ feat:` | `🐛 fix:` | `🧪 test:` | `♻️ refactor:` | `🧹 chore:` | `📝 docs:` | `🔧 build:` | `🔐 sec:` | `🗃️ db:` | `🧩 agent:`

**Use scopes:** e.g., `feat(auth): ...`, `db(schema): ...`.

## Caching & Revalidation (Next.js 15 “use cache” aware)

### What we use

* **Route/Component/Function-level caching:** the **`'use cache'` directive**. Enable via `experimental.useCache: true` in `next.config.ts`.
* You can place `'use cache'` at **file**, **component**, or **function** scope to cache the return value.
* **Default behavior of `'use cache'`:** server-side revalidation period \~ **15 minutes**; tune with `cacheLife(...)` and tag with `cacheTag(...)`.
* **Build-time use:** Adding `'use cache'` to a `page`/`layout` **prerenders** that route segment; you **cannot** use request-time APIs like `cookies()`/`headers()` there.
* **Data cache via `fetch`:** By default, **`fetch` is not cached**; to cache, set `next: { revalidate: seconds }` or `cache: 'force-cache'` (use sparingly; prefer `'use cache'` + profiles). Also note that even if `fetch` isn’t cached, route HTML can still be prerendered and cached.
* **On-demand invalidation:** Use **`revalidateTag(tag)`** from Server Actions/Route Handlers to invalidate entries associated with a tag; pages refetch on next visit.

### Enablement

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useCache: true, // enables 'use cache' without requiring cacheComponents
  },
};

export default nextConfig;
```

(Enables `'use cache'` independent of `cacheComponents`.)

### Patterns we follow

#### 1) Prerender stable routes

```tsx
// app/(marketing)/pricing/page.tsx
'use cache' // prerender this segment

import { unstable_cacheLife as cacheLife } from 'next/cache'; // alias recommended by Next docs
export default async function Page() {
  cacheLife('days'); // profile-defined or built-in timescale
  // fetch data or compute...
  return <Pricing />;
}
```

* **Use `'use cache'` at file top** for route-wide caching; children inherit unless they use Dynamic APIs.

#### 2) Cache component or function output

```tsx
// app/components/Bookings.tsx
export async function Bookings({ type }: { type: string }) {
  'use cache'
  // Optionally set a cache lifetime for this component
  // cacheLife('hours');
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/bookings?type=${encodeURIComponent(type)}`, {
    next: { tags: ['bookings'] }, // tag for later invalidation
  });
  const data = await res.json();
  return <List data={data} />;
}
```

* Scope `'use cache'` to expensive subtrees or data accessors.

#### 3) Tag and revalidate on writes (Server Actions)

```ts
// app/(admin)/bookings/actions.ts
'use server';
import { revalidateTag } from 'next/cache';

export async function updateBooking(input: unknown) {
  // ...validate, write to DB
  revalidateTag('bookings'); // invalidate; pages/components refetch on next visit
}
```

* `revalidateTag` is server-only (Server Actions/Route Handlers) and **marks items stale**; the next request triggers a refresh.

#### 4) Requests that must be dynamic

* Avoid `'use cache'` when the code **must** read `cookies()`/`headers()` at render time (these are request-time APIs and will opt out of prerendering).
* For transient or per-user data, **omit** caching and render dynamically.

#### 5) Data `fetch` caching (when opting in)

```ts
// Opt-in revalidation for data cache (not 'use cache')
await fetch('https://api.example.com/stats', { next: { revalidate: 3600, tags: ['stats'] } });
```

#### 6) Function Response Pattern

All agent functions must return a **standardized response shape** using the provided helpers.  
This ensures consistent success/error handling across the codebase.

```ts
export type CreateSuccess<T> = {
  ok: true;
  data: T;
};

export type CreateError<T = never> =
  | { ok: false; message: string }
  | { ok: false; message: string; errors: T };

export function createSuccess<T>(data: T): CreateSuccess<T> {
  return { ok: true, data };
}

export function createError(message: string): CreateError;
export function createError<T>(message: string, errors: T): CreateError<T>;
export function createError(message: string, errors?: unknown) {
  return errors === undefined
    ? { ok: false, message }
    : { ok: false, message, errors };
}


* Prefer **tagging** so mutations can `revalidateTag('stats')`.

### Notes & Gotchas

* `'use cache'` caches on the **server (in-memory)** and also stores returned content **in the browser memory** for the session (until revalidation).
* **Default revalidation for `'use cache'` is \~15 minutes**—always set an explicit `cacheLife(...)` for predictability, or custom profiles via config.
* You can cache entire routes by adding `'use cache'` to both `layout` and `page`.

## Example: Read/Write with Tags

```ts
// read.ts (RSC)
export async function getRooms() {
  'use cache';
  // cacheLife('hours');
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/rooms`, {
    next: { tags: ['rooms'] },
  });
  return res.json();
}

// actions.ts (Server Action)
'use server';
import { revalidateTag } from 'next/cache';
import { db } from '@/db';
import { rooms } from '@/db/schema';

export async function createRoom(input: { roomNumber: string; capacity: number }) {
  // ...validate & insert via drizzle...
  revalidateTag('rooms');
}
```

* This pairs route/component caching with tag-based invalidation for consistency.

## UI Components

* Keep UI components **pure** in `src/components/ui/*`. Fetch in a parent RSC and pass data as props to client components only when interactivity is needed.

## cn() Utility

Use cn() from @/lib/utils for all conditional classes:

```tsx
// Basic
className={cn("base", condition && "extra")}

// Variants
className={cn("base", { "active": isActive }, className)}
```

## Package Management
* Vetting: Before adding a new package, always check against context7 for the latest documentation to ensure the choice is consistent with our stack and best practices.
* Installation: Use npm for all package operations.
* Dependency Segregation: Strictly separate production and development dependencies.
* Production Dependencies: Packages required for the application to run in production (e.g., zod, drizzle, next). Install with npm install <package-name>.
* Development Dependencies: Packages used for local development, testing, linting, or building (e.g., vitest, eslint, @types/*). Install with npm install --save-dev <package-name>.


## CI

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm test
```

## Appendix: Quick refs to Next.js caching APIs we rely on

* **`'use cache'` directive** (file/component/function-level caching; default \~15 min; interop with `cacheLife`/`cacheTag`).
* **`experimental.useCache`** in `next.config.ts` (enables `'use cache'` without `cacheComponents`).
* **`revalidateTag(tag)`** to invalidate on write; works in Server Actions/Route Handlers.[4])
* **Data `fetch`** defaults (not cached unless opted-in; route HTML may still be prerendered & cached).

*This repo is “use cache”-aware. Prefer route/component-level caching with explicit lifetimes and tags; revalidate on writes. Keep user-specific paths dynamic by design.*

---
alwaysApply: true
---

YOU MUST NEVER START THE DEV SERVER UNLESS THE USER HAS TOLD YOU TO. 

Never run npm run dev, npm start, or the equivalent "start or build" command. 

The user is running the dev server locally and if you do that you could mess up the dev server. 

---
description: "Use shadcn/ui components as needed for any UI code"
patterns: "*.tsx"
---

# Shadcn UI Components

This project uses @shadcn/ui for UI components. These are beautifully designed, accessible components that you can copy and paste into your apps.

## Finding and Using Components

Components are available in the `src/components/ui` directory, following the aliases configured in `components.json`

## Using Components

Import components from the ui directory using the configured aliases:

```tsx
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
```

Example usage:

```tsx
<Button variant="outline">Click me</Button>

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card Description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card Content</p>
  </CardContent>
  <CardFooter>
    <p>Card Footer</p>
  </CardFooter>
</Card>
```

## Installing Additional Components

Many more components are available but not currently installed. You can view the complete list at https://ui.shadcn.com/r

To install additional components, use the Shadcn CLI:


```bash
npx shadcn@latest add [component-name]
```

For example, to add the Accordion component:

```bash
npx shadcn@latest add accordion
```

Note: `npx shadcn-ui@latest` is deprecated, use `npx shadcn@latest` instead

Some commonly used components are

- Accordion
- Alert
- AlertDialog
- AspectRatio
- Avatar
- Calendar
- Checkbox
- Collapsible
- Command
- ContextMenu
- DataTable
- DatePicker
- Dropdown Menu
- Form
- Hover Card
- Menubar
- Navigation Menu
- Popover
- Progress
- Radio Group
- ScrollArea
- Select
- Separator
- Sheet
- Skeleton
- Slider
- Switch
- Table
- Textarea
- Toast
- Toggle
- Tooltip

## Component Styling

This project uses the "new-york" style variant with the "neutral" base color and CSS variables for theming, as configured in `components.json`.
