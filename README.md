# SENTRA — dashboard

This is a Next.js Pages Router application. Existing UI markup and browser scripts are preserved; Express route modules run inside Next.js API Routes. There is no separate Express listener and no iframe. This is a compatibility migration, not a component-by-component React rewrite.

## Local startup

1. Run `npm install` in this folder.
2. Copy `.env.example` to `.env.local`, then fill your existing values.
3. Run `npm run dev`.
4. For a production build locally: `npm run build`, then `npm start`.

Open http://localhost:3001. Use that hostname consistently; PUBLIC_ORIGIN must match it exactly.

Keep existing Supabase accounts, device assignments and migrations. No reset required. SUPABASE_KEY is server-only and must have the required backend access; never prefix it NEXT_PUBLIC_.

For private Drive playback, either point GOOGLE_DRIVE_TOKEN_FILE to your existing local token JSON, or set the three OAuth environment variables. Never put the token file in public/.

## Background notifications

Keep the same VAPID key pair used by your existing subscriptions. Generate only if you do not already have keys: `npm run push:keys`.

In a second terminal in this folder, run `npm run push:worker`. It reads .env.local and stays running when the dashboard tab closes. It must remain running for real alert jobs. Python continues creating alerts in the same Supabase project. Existing migration 005's alert trigger enqueues push jobs. Admin does not run another worker.

In Settings, Enable notifications, allow permission, and Send test. Test sends directly through Web Push; it does not prove the background queue worker is running. To verify that separately, close the dashboard tab, keep the worker and Python online, and generate a new alert on a device assigned to your account. Alerts before subscribing are not automatically replayed.

A new localhost port or domain is a new browser origin: enable notifications again. Windows needs browser/site notification permission and OS notification permission; check Do Not Disturb. Android phone testing requires a trusted HTTPS origin; a plain HTTP LAN address is insufficient. APK wrappers are a separate integration and are not guaranteed to support browser Web Push. Force-stopped browsers and OS battery restrictions can prevent delivery.

The live data feed still polls every second; dashboard summary/history refresh remains 60 seconds as in the original. Push delivery is independent of those timers.

## Verification

`npm test`: worker retry/access checks, service-worker display/deep-link tests with mocked transport, script-isolation and API access checks. Keep the sibling admin folder for the cross-app migration test.

## Scope

Python source and database schema are unchanged. sql/ contains reference copies of the existing migrations; do not rerun or reset the database merely because of this migration. Vercel configuration, hosted worker scheduling and production media-streaming constraints are deferred as requested.
