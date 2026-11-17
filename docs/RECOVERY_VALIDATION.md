# ShopFlow recovery — 2026-11-17

The existing PR #21 is updated with a two-parent consolidation of actual main `b4a435b031d9929af70f16e07b438f60c896d197` (PR #22 already merged externally) and original PR #21 `84daf339af227b0aaca2e555f601201bba8bb6b4`. No default-branch merge or deployment is part of this recovery.

## Preserved behavior and fixes

- PR #21's corrupt-cart protection, all-or-nothing validation, memory-only fallback, authoritative in-memory Authorization token, persistence warnings and generation guards are retained. A failed token removal cannot silently revive authentication in the current tab.
- PR #22's version 1 cart format, migration from historical arrays, totals in integer grosz, quantity/price limits, 15-second API timeout, network-session retry and explicit simulated orders are retained. Newer main lock entries (including Vite 6.4.6, follow-redirects 1.16.3 and Vitest 5.1.0) were kept instead of replacing them with older PR #21 versions.
- `/auth/me` network failures preserve the token for retry; 401/403/404 and malformed identity responses end the session. Tests include logout while retry/login responses are pending, invalid/null responses, failed persistence and cross-tab changes.
- Orders whose subtotal exceeds 2,147,483,647 groszy return 400 before applying coupons or writing a transaction. This prevents Prisma Int overflow, including when individually valid lines combine to exceed the limit or a coupon would reduce only the final total. Excessive product stock is also rejected before persistence. Exact-boundary orders still work.
- Older request-body fixes and Zod 4 are retained; malformed/oversized/unsupported encoded bodies return client errors without leaking raw details. Node.js 24.15+ within the 24 line is consistent across both packages and CI. Audits reject every reported severity.

## Runtime evidence

- Both packages: clean `npm ci`, type checking and production build PASS.
- Backend: 57 API/rate-limit/request-body tests PASS on real temporary SQLite, plus one new populated historical database migration regression PASS. The latter builds the exact historical schema, records that initial migration, deploys the unchanged money migration, validates stored records/relations/coupon units, and repeats deployment without changing data. Total 58 cases; no production database is touched.
- Frontend: 41 real React/Axios provider regressions PASS. Storage and HTTP responses are controlled fixtures; these are component tests.
- Three real Chromium scenarios PASS with sandbox enabled: actual API/SQLite fixed-coupon checkout and saved order reload with accessibility checks; corrupt-cart preservation plus historical-array migration; network abort during session restoration, real API retry and failed persistent logout without reuse of the saved token in a subsequent request.
- Both raw npm audits report zero known advisories on 2026-11-17.
- Independent read-only reviews found null/404 session handling and Int-overflow issues. These were fixed and reviewed again; reviewers confirmed source/validation-copy parity and the final money guard, tests, browser scenarios and historical migration fixture.

Local results do not substitute for hosted Actions: verify the current PR #21 head before accepting it. No real payment, shipment, public deployment, browser-cookie production session or hardware/infrastructure availability claim is made.

## Existing PR disposition

All PRs remain open unless already merged externally. No closure is authorized by this document. Open PR file diffs and their head checks were retrieved and reviewed during recovery.

| PR | Disposition |
| --- | --- |
| #21 | Updated in place; retains its original ancestry and incorporates merged #22. |
| #22 | Already merged externally; exact-money and demo-state behavior preserved. |
| #19, #20 | upload-artifact v7 and setup-python v7 incorporated in this combined CI; retain until separately approved for closure. |
| #8 | Zod 4 update covered by the newer 4.6.7-or-compatible locked dependency and request-body/API tests here. |
| #5, #17 | Prisma/client 7 must migrate together; do not merge either standalone over the tested Prisma 6.19.2 schema/migrations. |
| #4, #10 | Vite 8/plugin-react 6 are a separate paired migration; current Vite 6.4.6/plugin-react 4 toolchain is validated and audit-clean. |
| #7, #13 | React/types and react-dom/types must remain mutually compatible; retain as a coordinated optional upgrade. |
| #12, #16, #18 | TypeScript 7, dotenv 18 and Node 26 types are optional major updates; evaluate separately against this validated Node 24 toolchain. Historical green checks alone are not final-head compatibility evidence. |

The validated cart is stored locally without encryption. A corrupted or inaccessible saved cart remains untouched, while edits continue only in tab memory and are lost on reload. There is no automatic repair/import UI. Multiple tabs are not a transactional cart database. Session invalidation in one running tab is not server-side revocation of JWTs, which expire after seven days. Existing databases need a verified backup/schema check before migration; demo seed credentials must stay confined to local fixtures.
