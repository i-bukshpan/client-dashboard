# Nehemiah OS v2 architecture contract

This contract applies only to `/workspace`, `/v2`, their API routes, and v2 server modules.
Moshe Portal and the legacy CRM are explicitly outside its scope.

## Source-of-truth boundaries

- Google Sheets owns client financial and operational records.
- Google Drive owns client documents and generated artifacts.
- Google Calendar owns meetings and calendar reminders.
- Supabase owns CRM metadata, v2 settings, Google resource IDs, access grants, sync cursors, and rebuildable indexes.
- A derived Supabase index must never silently become the authoritative financial or document record.

## Server boundary

- Every v2 page, Route Handler, and Server Action authorizes through `requireWorkspaceAdmin()`.
- Privileged Supabase access is obtained only through the server-only v2 DAL.
- Client IDs and mutation payloads are validated at the entry point.
- Google credentials and service-role credentials never cross a Server Component boundary.
- Drive folder IDs must be proven to descend from the selected client's configured root.

## Google authentication

The v2 gateway uses a fresh auth client for every operation:

1. Nehemiah OAuth credentials (`GOOGLE_OAUTH_*`) when configured.
2. Service account credentials (`GOOGLE_SERVICE_ACCOUNT_*`) as fallback for Drive and Sheets.
3. Calendar requires OAuth unless service-account domain-wide delegation has an explicit subject.

Legacy Google authentication remains independent and is not migrated implicitly.

## Release gate

- v2 TypeScript errors: zero
- v2-scoped ESLint errors: zero
- authorization tests cover 401, 403, invalid IDs, and cross-client resource access
- production build passes, or any remaining failure is demonstrated to be outside the v2 boundary
- no Moshe Portal or legacy behavior changes are included in a v2 release
