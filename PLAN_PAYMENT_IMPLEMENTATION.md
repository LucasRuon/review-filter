# Implementation Plan: Admin Panel Billing & Sidebar Improvements

## Overview
This plan addresses two main improvements needed in the admin panel:
1. **Admin Billing Screen** - Update the billing page with proper Stripe integration data
2. **Sidebar Collapse Bug** - Fix the issue where tab names still appear when the sidebar is collapsed

---

## Issue 1: Admin Sidebar Collapse Bug

### Problem
In the admin panel (`views/admin/index.html`), when the sidebar is collapsed, the navigation text (e.g., "Dashboard", "Usuarios", "Configuracoes") is still visible. The sidebar uses inline text directly inside the `<a>` tags instead of using a `<span class="nav-text">` wrapper like the main app does.

### Current Code (lines 203-220)
```html
<a href="#" class="nav-item" data-page="dashboard" onclick="navigateTo('/admin'); return false;">
    <i class="fas fa-chart-line nav-icon"></i> Dashboard
</a>
```

### Solution
Wrap navigation text in `<span class="nav-text">` elements and add CSS to hide them when collapsed.

### Files to Modify
- `views/admin/index.html`

### Changes Required

1. **Update sidebar nav items (lines 203-220)** - Wrap text in `<span>` elements:
```html
<a href="#" class="nav-item" data-page="dashboard" onclick="navigateTo('/admin'); return false;">
    <i class="fas fa-chart-line nav-icon"></i><span class="nav-text">Dashboard</span>
</a>
<a href="#" class="nav-item" data-page="users" onclick="navigateTo('/admin/users'); return false;">
    <i class="fas fa-users nav-icon"></i><span class="nav-text">Usuarios</span>
</a>
<!-- ... same pattern for other nav items -->
```

2. **Update logout nav item (line 230-232)**:
```html
<a href="#" class="nav-item" onclick="logout(); return false;">
    <i class="fas fa-sign-out-alt nav-icon"></i><span class="nav-text">Sair</span>
</a>
```

3. **Update CSS rule (line 50)** - The current rule targets `span:not(.nav-icon)` but it needs to also hide `.nav-text`:
```css
.sidebar.collapsed .nav-text { display: none; }
```

---

## Issue 2: Admin Billing Screen Enhancement

### Problem
The current billing page (`loadBilling()` function, lines 1248-1264) shows a static "Stripe not configured" message. Now that Stripe is integrated, we need to display:
- Subscription statistics (active subscribers, revenue, etc.)
- Recent subscriptions list
- Subscription management options
- Revenue charts

### Solution
Create a comprehensive billing dashboard that shows:
1. Revenue statistics cards (MRR, total revenue, active subscribers, trial users)
2. Subscriptions by plan chart
3. Recent subscriptions table with actions
4. Link to Stripe dashboard

### Files to Modify
- `views/admin/index.html` - Update `loadBilling()` function
- `routes/admin.js` - Add new API endpoint for billing stats

---

## Implementation Details

### Backend: Add billing stats endpoint in `routes/admin.js`

Add new endpoint `GET /admin/api/billing/stats`:

```javascript
// GET /admin/api/billing/stats
router.get('/api/billing/stats', requireAdmin, async (req, res) => {
    try {
        const db = getDb();

        // Get subscription stats
        const stats = await db.get(`
            SELECT
                COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_subscriptions,
                COUNT(CASE WHEN subscription_status = 'trial' THEN 1 END) as trial_users,
                COUNT(CASE WHEN subscription_status = 'canceled' THEN 1 END) as canceled,
                COUNT(CASE WHEN subscription_status = 'past_due' THEN 1 END) as past_due,
                COUNT(CASE WHEN subscription_plan = 'pro' THEN 1 END) as pro_subscribers,
                COUNT(CASE WHEN subscription_plan = 'free' OR subscription_plan IS NULL THEN 1 END) as free_users
            FROM users
        `);

        // Get recent subscriptions
        const recentSubscriptions = await db.all(`
            SELECT u.id, u.name, u.email, u.subscription_status, u.subscription_plan,
                   u.subscription_ends_at, u.last_payment_at, u.created_at
            FROM users u
            WHERE u.subscription_status IS NOT NULL
              AND u.subscription_status != 'free'
            ORDER BY u.last_payment_at DESC NULLS LAST
            LIMIT 10
        `);

        // Get subscription history events
        const recentEvents = await db.all(`
            SELECT sh.*, u.name as user_name, u.email as user_email
            FROM subscription_history sh
            JOIN users u ON sh.user_id = u.id
            ORDER BY sh.created_at DESC
            LIMIT 20
        `);

        // Get MRR estimate
        const settings = await db.get(`SELECT value FROM platform_settings WHERE key = 'pro_monthly_price_brl'`);
        const monthlyPrice = settings ? parseInt(settings.value) / 100 : 89.90;
        const mrr = (stats.active_subscriptions || 0) * monthlyPrice;

        res.json({
            success: true,
            stats: {
                activeSubscriptions: stats.active_subscriptions || 0,
                trialUsers: stats.trial_users || 0,
                canceledUsers: stats.canceled || 0,
                pastDueUsers: stats.past_due || 0,
                proSubscribers: stats.pro_subscribers || 0,
                freeUsers: stats.free_users || 0,
                mrr: mrr,
                currency: 'BRL'
            },
            recentSubscriptions,
            recentEvents
        });
    } catch (error) {
        console.error('Error fetching billing stats:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar estatisticas' });
    }
});
```

### Frontend: Update `loadBilling()` in `views/admin/index.html`

The new billing page will include:
- Stats grid with MRR, active subscribers, trial users, past due
- Plans distribution doughnut chart
- Quick actions to Stripe dashboard
- Recent subscriptions table
- Subscription events history

---

## Implementation Steps

### Step 1: Fix Sidebar Collapse Issue
1. Open `views/admin/index.html`
2. Wrap all navigation text in `<span class="nav-text">` elements (lines 203-220, 230-232)
3. Add CSS rule to hide `.nav-text` when collapsed

### Step 2: Add Backend Billing Stats Endpoint
1. Open `routes/admin.js`
2. Add the new `/admin/api/billing/stats` endpoint with database queries

### Step 3: Update Frontend Billing Page
1. Open `views/admin/index.html`
2. Replace `loadBilling()` function with enhanced version
3. Add helper functions: `getSubscriptionStatusBadge()`, `getEventBadgeClass()`, `formatEventType()`, `formatEventMetadata()`, `renderPlansChart()`

### Step 4: Test
1. Test sidebar collapse on admin panel - verify text disappears
2. Test billing page with Stripe configured - verify stats appear
3. Test billing page without Stripe configured - verify helpful message appears
4. Verify chart renders correctly

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `views/admin/index.html` | 1. Fix sidebar nav text wrapping (add `<span class="nav-text">`)<br>2. Add CSS for `.nav-text` hiding<br>3. Update `loadBilling()` function<br>4. Add helper functions for billing page |
| `routes/admin.js` | Add `/admin/api/billing/stats` endpoint |

---

## Estimated Changes

### `views/admin/index.html`
- Lines 50: Add `.sidebar.collapsed .nav-text { display: none; }`
- Lines 203-220: Wrap nav text in `<span class="nav-text">`
- Lines 230-232: Wrap logout text in `<span class="nav-text">`
- Lines 1248-1264: Replace entire `loadBilling()` function (~150 lines of new code)
- Add 4 new helper functions (~50 lines)

### `routes/admin.js`
- Add new endpoint (~50 lines)

---

## Optional Future Enhancements

1. Add revenue trend chart (last 30 days)
2. Add subscription conversion rate metrics
3. Add export to CSV functionality for subscriptions
4. Add email templates for payment reminders
5. Add refund management from admin panel
