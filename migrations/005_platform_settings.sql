-- Migration 005: Additional Platform Settings
-- Configuration for subscription plans, pricing, and trial settings

INSERT INTO platform_settings (key, value) VALUES
    ('trial_reminder_days', '3'),
    ('grace_period_days', '7'),
    ('enable_yearly_discount', 'true'),
    ('yearly_discount_percent', '20'),
    ('pro_monthly_price_brl', '9700'),
    ('pro_yearly_price_brl', '93120'),
    ('enterprise_monthly_price_brl', '29700'),
    ('enterprise_yearly_price_brl', '285120'),
    ('stripe_price_id_pro_monthly', ''),
    ('stripe_price_id_pro_yearly', ''),
    ('stripe_price_id_enterprise_monthly', ''),
    ('stripe_price_id_enterprise_yearly', '')
ON CONFLICT (key) DO NOTHING;
