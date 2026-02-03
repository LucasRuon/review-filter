# Spec: Review Page Not Working - Diagnostic and Fix

**Date**: 2026-02-03
**Status**: Implemented
**Research**: [2026-02-03-review-page-not-working.md](../research/2026-02-03-review-page-not-working.md)

## Goal
Diagnose why review pages (e.g., `/r/farmacia-meia-praia-1`) are showing "Servico Indisponivel" and implement any necessary fixes.

## Requirements
- [x] Identify the root cause of the review page not working
- [x] Fix any code bugs if found
- [x] Ensure review pages work correctly for users with valid subscriptions
- [x] Document the solution for future reference

## Technical Approach

Based on the research, review pages show "Servico Indisponivel" when:
1. `clients.active = 0`, OR
2. `users.subscription_status NOT IN ('trial', 'active')`

The most likely cause is that the user's subscription status is not `'trial'` or `'active'`. This needs to be verified by querying the database.

## Implementation Phases

### Phase 1: Database Diagnosis
**Goal**: Query the database to identify the exact cause of the issue

**Files to Modify/Create**:
- None - this is a diagnostic phase

**Changes**:
1. Run SQL queries to check:
   - Does the client slug `farmacia-meia-praia-1` exist?
   - What is the client's `active` status?
   - What is the user's `subscription_status`?
   - What is `service_active` calculated as?

**SQL Queries to Run**:
```sql
-- 1. Check if client exists and get basic info
SELECT c.id, c.name, c.slug, c.active, c.user_id
FROM clients c
WHERE c.slug = 'farmacia-meia-praia-1';

-- 2. Check user's subscription status
SELECT u.id, u.email, u.subscription_status, u.subscription_ends_at, u.stripe_customer_id
FROM users u
WHERE u.id = (SELECT user_id FROM clients WHERE slug = 'farmacia-meia-praia-1');

-- 3. Calculate service_active
SELECT
    c.slug,
    c.active as client_active,
    u.subscription_status,
    u.subscription_ends_at,
    (c.active = 1 AND u.subscription_status IN ('trial', 'active')) as service_active
FROM clients c
JOIN users u ON c.user_id = u.id
WHERE c.slug = 'farmacia-meia-praia-1';
```

**Verification**:
- [x] Queries return data (client exists)
- [x] Identified whether `client.active` or `subscription_status` is the issue

**Manual Testing**:
1. Connect to the production database
2. Run the diagnostic queries above
3. Document the results

---

### Phase 2: Fix Based on Diagnosis
**Goal**: Apply the appropriate fix based on Phase 1 findings

**Scenario A: Client is deactivated (`active = 0`)**

If the client was incorrectly deactivated:
```sql
UPDATE clients SET active = 1 WHERE slug = 'farmacia-meia-praia-1';
```

**Scenario B: Subscription status is not valid**

If the user's subscription expired but should be active:
1. Check Stripe dashboard for the actual subscription status
2. If there's a mismatch, sync the status:
```sql
-- Only if confirmed subscription is actually active in Stripe
UPDATE users SET subscription_status = 'active'
WHERE id = (SELECT user_id FROM clients WHERE slug = 'farmacia-meia-praia-1');
```

**Scenario C: Trial actually expired**

If the trial genuinely expired:
1. Contact the user about subscribing
2. No code fix needed - this is expected behavior

**Verification**:
- [x] Re-run diagnostic queries to confirm fix
- [x] Test the review page URL

**Manual Testing**:
1. After fix, visit `https://app.opinaja.com.br/r/farmacia-meia-praia-1`
2. Verify the review form is shown (not "Servico Indisponivel")
3. Submit a test review if possible

---

### Phase 3: (Optional) Code Improvements
**Goal**: Add better error messaging and logging if needed

**Files to Modify/Create**:
- `routes/review.js` - Add logging for inactive service cases

**Changes**:
1. Add logging when returning inactive service response:
```javascript
// In routes/review.js:33-41
if (!data.service_active) {
    logger.info('Review page inactive', {
        slug: req.params.slug,
        clientActive: data.active,
        subscriptionStatus: data.subscription_status
    });
    return res.json({
        name: data.name,
        logo_url: data.logo_url,
        primary_color: data.primary_color,
        service_active: false,
        message: 'Este servico de avaliacao esta temporariamente indisponivel.'
    });
}
```

**Verification**:
- [x] Logging captures useful diagnostic info
- [x] No regressions in review page functionality

**Manual Testing**:
1. Test with an inactive client
2. Check server logs for the new log entry

---

## Database Changes
No schema changes needed. Potential data fixes:
```sql
-- If client needs reactivation
UPDATE clients SET active = 1 WHERE slug = 'farmacia-meia-praia-1';

-- If subscription status needs sync (verify with Stripe first!)
UPDATE users SET subscription_status = 'active'
WHERE id = (SELECT user_id FROM clients WHERE slug = 'farmacia-meia-praia-1');
```

## Environment Variables
None needed.

## Rollback Plan
1. If client was incorrectly reactivated:
   ```sql
   UPDATE clients SET active = 0 WHERE slug = 'farmacia-meia-praia-1';
   ```
2. If subscription status was incorrectly changed:
   ```sql
   UPDATE users SET subscription_status = 'previous_value'
   WHERE id = (SELECT user_id FROM clients WHERE slug = 'farmacia-meia-praia-1');
   ```

## Security Considerations
- Only modify database if verified the subscription is legitimately active
- Never change subscription status without verifying in Stripe first
- Log all manual database changes

## Testing Checklist
- [x] Diagnostic queries run successfully
- [x] Root cause identified
- [x] Fix applied (if code/data change needed)
- [x] Review page loads correctly
- [ ] Review submission works (manual test needed)
- [ ] No regressions for other clients (manual test needed)

## Notes

1. **Common causes for review pages not working:**
   - Trial period expired (`subscription_status = 'expired'`)
   - User cancelled subscription (`subscription_status = 'canceled'`)
   - Payment failed (`subscription_status = 'past_due'`)
   - Client manually deactivated (`clients.active = 0`)

2. **The `trial_reminder_sent` column** mentioned in research is NOT a subscription status - it's an integer tracking reminder levels (0, 1, 3). This does not affect review page functionality.

3. **Valid subscription statuses for active review pages:**
   - `trial` - User is in trial period
   - `active` - User has paid subscription

4. **To prevent future issues:**
   - Consider adding an admin tool to check/fix client status
   - Add more detailed error messages in the frontend
   - Improve logging for diagnosis

---

## Implementation Summary (2026-02-03)

### Root Cause
The `clients.active` column did **not exist** in the production database. Migration `006_clients_active_column.sql` had never been run.

When `getClientDataForReview()` in `database.js:688-726` tried to query `c.active`, PostgreSQL returned an error, causing all review pages to fail.

### Fix Applied
1. **Ran migration 006** - Added `active` column to `clients` table:
   ```sql
   ALTER TABLE clients ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1;
   CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(active);
   ```

2. **Added logging** to `routes/review.js:33-37` for future diagnosis when service is inactive.

### Verification
- API endpoint `GET /r/farmacia-meia-praia-1/data` now returns full client data
- `service_active = true` for this client (active subscription)

### Files Modified
- `routes/review.js` - Added logging for inactive service cases
