CREATE OR REPLACE FUNCTION public.tend_firmante_autorizante(_org uuid,_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
 SELECT _org=public.get_user_org_id() AND EXISTS(SELECT 1 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id
 WHERE m.org_id=_org AND m.user_id=_user AND p.activo AND m.role<>'super_admin' AND
 (public.has_role(_user,'responsable_sanitario'::public.app_role) OR EXISTS(SELECT 1 FROM public.org_suplencias s
 WHERE s.org_id=_org AND s.suplente_user_id=_user AND s.revocada_en IS NULL
 AND now()>=s.fecha_inicio AND now()<s.fecha_fin AND 'autorizar'=ANY(s.facultades))))
$fn$;
REVOKE ALL ON FUNCTION public.tend_firmante_autorizante(uuid,uuid) FROM PUBLIC,anon,authenticated;