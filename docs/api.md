# API Reference

Base URL: `/api/v1`

All protected endpoints require `Authorization: Bearer <access_token>` header. Responses use the envelope format `{ data, error }`.

## Health

```
GET /health
```

Returns `200 OK` when the server is running.

## Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create account (email, password, full_name) |
| POST | `/auth/login` | No | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | No | Exchange refresh token for new token pair |
| POST | `/auth/logout` | Yes | Revoke refresh token |
| GET | `/auth/me` | Yes | Get current user profile |

**Token lifecycle:** Access tokens expire in 15 minutes. Refresh tokens expire in 7 days. The frontend API client (`ky`) automatically refreshes on 401 responses.

## Workplaces

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workplaces` | List all workplaces for the current user |
| POST | `/workplaces` | Create workplace (name, pay_model, base_rate_cents, ...) |
| GET | `/workplaces/{id}` | Get workplace details |
| PUT | `/workplaces/{id}` | Update workplace |
| DELETE | `/workplaces/{id}` | Soft-delete (sets `is_active = false`) |

### Pricing Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workplaces/{id}/pricing-rules` | List pricing rules ordered by priority |
| POST | `/workplaces/{id}/pricing-rules` | Create pricing rule |
| PUT | `/workplaces/{id}/pricing-rules/{ruleId}` | Update pricing rule |
| DELETE | `/workplaces/{id}/pricing-rules/{ruleId}` | Delete pricing rule |
| POST | `/workplaces/{id}/pricing-rules/reorder` | Bulk reorder priorities |
| GET | `/workplaces/{id}/earnings-summary` | Earnings summary for a workplace |

## Shifts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shifts?start=...&end=...` | List shifts in date range (supports `expand_recurrences=true`) |
| POST | `/shifts` | Create shift (auto-calculates earnings) |
| GET | `/shifts/{id}` | Get shift details |
| PUT | `/shifts/{id}` | Update shift (recalculates earnings) |
| DELETE | `/shifts/{id}` | Delete shift |
| PATCH | `/shifts/{id}/status` | Update shift status |
| POST | `/shifts/bulk` | Create multiple shifts at once |
| GET | `/shifts/{id}/earnings` | Get earning segments for a shift |
| POST | `/shifts/{id}/earnings/confirm` | Confirm projected earnings |

## Finance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/finance/summary?month=...&year=...` | Earnings summary for a period |
| GET | `/finance/summary/monthly/{year}/{month}` | Monthly breakdown |
| GET | `/finance/summary/yearly/{year}` | Yearly summary |
| GET | `/finance/projections` | Future earnings projections |
| GET | `/finance/tax-estimate/{year}` | Portuguese tax estimate for a fiscal year |

## Invoices (Recibos Verdes)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List invoices |
| POST | `/invoices` | Create invoice |
| GET | `/invoices/{id}` | Get invoice details |
| PUT | `/invoices/{id}` | Update invoice |
| DELETE | `/invoices/{id}` | Delete invoice |

## Google Calendar

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/gcal/auth-url` | Get OAuth2 consent URL |
| POST | `/gcal/callback` | Exchange auth code for tokens |
| POST | `/gcal/sync` | Trigger manual two-way sync |
| GET | `/gcal/status` | Check sync status (connected, last sync time) |
| DELETE | `/gcal/disconnect` | Revoke tokens and disconnect |
| POST | `/gcal/webhook` | Google push notification receiver (no auth) |
