UPDATE public.organizations SET max_users = 3 WHERE plan = 'starter';
UPDATE public.organizations SET max_users = 10 WHERE plan = 'professional';
UPDATE public.organizations SET max_users = 9999 WHERE plan = 'enterprise';