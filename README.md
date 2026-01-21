This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase setup (local)

Add these to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Apply migrations (Supabase CLI):

```bash
supabase db push
```

## Create a letter + open token (dev utility)

Use the placeholder route to mint a letter and open token:

```bash
curl -X POST http://localhost:3000/api/dev/create-letter \\
  -H 'Content-Type: application/json' \\
  -d '{
    \"sender_user_id\": \"<auth-user-uuid>\",
    \"bird_type\": \"pigeon\",
    \"dest_region_id\": \"downtown-seattle\",
    \"eta_at\": \"2025-01-01T12:00:00Z\",
    \"message\": \"Hello from the flock\",
    \"recipient_email\": \"receiver@example.com\"
  }'
```

The response includes a `token` you can open at `/l/<token>`.

## Localhost vs 127.0.0.1 (auth cookies)

Cookies are scoped per host, so `localhost` and `127.0.0.1` do not share auth sessions. This project redirects any `127.0.0.1` request to `http://localhost:3000` and uses a canonical app URL for OTP email links.

Add the canonical base URL to your env (do not commit secrets):

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Supabase Auth Redirect URLs must include the callback URL you use (for example `http://localhost:3000/auth/callback`) or OTP email links will fail.

Test:
1) Start dev server
2) Visit `http://127.0.0.1:3000/sent` → should redirect to `http://localhost:3000/sent`
3) Trigger email OTP from a letter preview page
4) Email link should land on `http://localhost:3000/auth/callback?...` and return to `/l/<token>`
5) `/api/dev/create-letter` should work when logged in on localhost

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
