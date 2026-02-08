# ShiftMD QA Testing Memory

## Test Infrastructure Notes
- Backend unit tests use hand-rolled mock repositories (not mockgen/gomock)
- Mock repositories don't actually implement filter logic (ListShifts mock ignores ShiftFilter)
- No integration tests exist for schedule_repo.go ListShifts SQL queries
- This means adapter layer SQL changes won't be caught by existing test suite
- ESLint is not installed as a dev dependency (lint checks fail with missing eslint binary)

## SQL Query Changes - Dashboard Fix (2026-02-08)
Changed ListShifts query from fully-contained filter to overlap filter:
- Old: `start_time >= $2 AND end_time <= $3` - only returns shifts completely within query range
- New: `start_time < $3 AND end_time > $2` - returns shifts overlapping with query range
- This is correct interval overlap logic and fixes "Hours This Week" not counting weekend shifts that straddle boundaries
- Frontend consolidated two separate shift queries (past/upcoming) into single 90-day range query with client-side splits

## Frontend Changes Confirmed Working
- dashboard.tsx imports useProjections hook correctly
- calculatePortugueseTax import from shared utils present
- No TypeScript type errors detected
- Calendar locale and slot duration changes appear correct

## Known Testing Gaps
- ESLint is not properly configured; lint command fails with "eslint: command not found"
- No adapter layer (postgres) unit/integration tests
- SQL query correctness cannot be verified without database integration tests
