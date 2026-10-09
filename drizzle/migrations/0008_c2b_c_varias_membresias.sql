-- C2b Parte C: permitir varias membresías (UNIQUE(user_id, org_id) ya existe desde 0007).
ALTER TABLE public.org_members DROP CONSTRAINT org_members_user_id_key;