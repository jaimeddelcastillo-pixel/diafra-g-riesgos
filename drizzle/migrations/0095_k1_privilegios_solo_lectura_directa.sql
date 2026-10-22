REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.puestos,public.kpi_definiciones,public.kpi_puesto,public.kpi_puesto_aporta FROM authenticated,anon;
GRANT SELECT ON public.puestos,public.kpi_definiciones,public.kpi_puesto,public.kpi_puesto_aporta TO authenticated;
GRANT ALL ON public.puestos,public.kpi_definiciones,public.kpi_puesto,public.kpi_puesto_aporta TO service_role;