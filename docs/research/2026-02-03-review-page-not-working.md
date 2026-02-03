# Research: Review Page Not Working

**Date**: 2026-02-03
**Purpose**: Investigate why review pages like `/r/farmacia-meia-praia-1` are not working

## Overview

The user reported that review pages (e.g., `https://app.opinaja.com.br/r/farmacia-meia-praia-1`) are not functioning. This research documents how the review page system works and identifies potential causes.

## Current Implementation

### Key Files

| File | Purpose |
|------|---------|
| `routes/review.js` | Backend routes for `/r/:slug` endpoints |
| `views/review.html` | Frontend review page UI (vanilla HTML/JS) |
| `database.js:688-726` | `getClientDataForReview()` - fetches client data with service status |

### Route Flow

1. **GET `/r/:slug`** (routes/review.js:11-21)
   - Looks up client by slug via `db.getClientBySlug(slug)`
   - If not found: returns 404 "Pagina nao encontrada"
   - If found: serves `views/review.html`

2. **GET `/r/:slug/data`** (routes/review.js:25-47)
   - Calls `db.getClientDataForReview(slug)` - single optimized query
   - If `service_active === false`: returns limited data with inactive message
   - Otherwise: returns full client data (name, topics, branches, google_review_link, etc.)

3. **POST `/r/:slug/complaint`** (routes/review.js:51-198)
   - Checks `service_active` before accepting submissions
   - Blocks with 403 if service is inactive

### Frontend Logic (views/review.html)

1. On page load, calls `loadClient()` (line 231-281)
2. Determines if custom domain or `/r/` route (line 224)
3. Fetches data from `/r/${slug}/data` or `/custom-domain-data`
4. **Critical Check** (line 239-241):
   ```javascript
   if (data.service_active === false) {
       showInactiveServiceMessage(data);
       return;
   }
   ```
5. If inactive, shows "Servico Indisponivel" message instead of review form

### Service Active Logic (database.js:715-718)

```javascript
const isServiceActive = row.active === 1 &&
    ['trial', 'active'].includes(row.subscription_status);
```

A review page is **active** only when BOTH:
- `clients.active = 1`
- `users.subscription_status IN ('trial', 'active')`

## Potential Causes for Review Page Not Working

### 1. Subscription Status Issue (Most Likely)

If the user's `subscription_status` is NOT `'trial'` or `'active'`, the page shows "Servico Indisponivel".

**Possible status values that cause this:**
- `free` - Default, no subscription
- `expired` - Trial/subscription ended
- `canceled` - User canceled
- `past_due` - Payment failed
- `trial_reminder_sent` - Trial reminder sent (but not in allowed list!)

### 2. Client Deactivated

If `clients.active = 0`, the service is marked inactive.

This happens when:
- Subscription is deleted (via Stripe webhook `customer.subscription.deleted`)
- Subscription status changes to `canceled` or `expired`
- Manual deactivation

### 3. Client Slug Not Found

If the slug doesn't exist in the database, returns 404 "Cliente nao encontrado".

### 4. Database/Server Error

If `getClientDataForReview()` throws an error, returns 500 "Erro ao buscar dados".

## Debugging Steps

To diagnose the specific client `farmacia-meia-praia-1`:

### 1. Check if slug exists and get client data
```sql
SELECT c.id, c.name, c.slug, c.active, c.user_id
FROM clients c
WHERE c.slug = 'farmacia-meia-praia-1';
```

### 2. Check user's subscription status
```sql
SELECT u.id, u.email, u.subscription_status, u.subscription_end_date
FROM users u
WHERE u.id = (SELECT user_id FROM clients WHERE slug = 'farmacia-meia-praia-1');
```

### 3. Check service_active calculation
```sql
SELECT
    c.slug,
    c.active as client_active,
    u.subscription_status,
    (c.active = 1 AND u.subscription_status IN ('trial', 'active')) as service_active
FROM clients c
JOIN users u ON c.user_id = u.id
WHERE c.slug = 'farmacia-meia-praia-1';
```

### 4. Test the API endpoint directly
```bash
curl -s https://app.opinaja.com.br/r/farmacia-meia-praia-1/data | jq
```

## Important Notes

1. **`trial_reminder_sent` status bug**: The code only allows `['trial', 'active']` for service_active, but `trial_reminder_sent` is a valid trial state. This could cause pages to incorrectly show as inactive.

2. **Recent changes**: The `clients.active` column was added recently (migration 006). Ensure the migration ran successfully in production.

3. **Custom domain support**: If the client has a custom domain configured, they might have a different route (`/custom-domain-data`). Check if they're trying to access via custom domain vs `/r/` route.

## Recommendations

1. **Query the database** to check the specific client's status
2. **Check if `trial_reminder_sent`** should be included in the allowed subscription statuses for service_active
3. **Verify the migration** for `clients.active` column ran in production
4. **Check server logs** for any errors when accessing the review page
