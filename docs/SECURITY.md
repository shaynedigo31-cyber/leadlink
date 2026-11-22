# Security

## Rules

- Enforce authorization in PostgreSQL RLS and validated RPCs; hidden buttons
  are not a security boundary.
- The browser may contain only the Supabase URL and publishable key. Never put
  a secret or `service_role` key in frontend code, chat, or git.
- Keep local credentials in ignored `.env.local`; `.env.example` contains
  placeholders only.
- Never apply a migration to production based on its filename or a previous
  assumption. Inspect the migration, actual live schema/data, migration
  history, grants, policies, and possible partial execution first.

## Database authorization

- `profiles.is_platform_admin` is not writable by client roles.
- Direct authenticated membership and organization-role mutations are revoked
  after migration 0002. Validated SECURITY DEFINER RPCs enforce caller
  permissions, approved-organization state, role scope, and Owner invariants.
- Normal organization permission checks require an active membership in an
  approved organization. Platform-admin status is not a substitute for
  organization membership or Owner status.
- Roles are bound to their organization by the 0003 composite foreign key.
- Table and column grants are checked together. RLS does not protect against
  TRUNCATE, and SECURITY DEFINER owners must be trusted.

## Audit logs, invitations, and profile preferences (migration 0004)

- Client roles can read activity logs under RLS but cannot insert, update, or
  delete them. `log_org_activity` and all audit-trigger functions have client
  EXECUTE revoked; do not grant the generic logger to organization managers.
- Database triggers record organization, membership, position, role,
  ownership-transfer, and invitation changes transactionally. Manual SQL
  executed without a user JWT may have a null `actor_id`.
- Invitation acceptance must verify the intended email, expiry, current
  approved-organization state, and same-organization non-Owner role. The RPC
  returns `accepted`, `declined`, or `expired`; the UI must not treat `expired`
  as successful acceptance.
- Expiration is lazy: responding to an expired invitation or resending to the
  same organization/email persists the `expired` state and event. There is no
  scheduled expiry worker.
- Profile preferences are JSONB and limited by a type check; only the
  `preferences` column is directly writable in addition to `full_name` and
  `avatar_url`.

## Migration and verification status

Migrations are intended to run in order: `0001` once, then `0002`, `0003`,
`0004`. Migration 0001 is not rerunnable. Later migrations have transaction
blocks but still require a live preflight; a transaction does not make an
unknown partially applied schema safe to replay.

The latest recorded read-only production preflight in this project session
found missing CLI migration history and partial/mixed migration state. No
production changes are authorized by that result. The current source changes
and comprehensive expected catalog checks are documented in
[`PHASE3_FINAL_SECURITY_REVIEW.md`](./PHASE3_FINAL_SECURITY_REVIEW.md).

Static source review and local build do not prove RLS behavior. The two-account
regression plan in [`PHASE3_TWO_ACCOUNT_TEST_PLAN.md`](./PHASE3_TWO_ACCOUNT_TEST_PLAN.md)
has not been executed against a controlled Supabase database. Do not call the
application production-ready until live catalog checks and behavioral tests
pass.
