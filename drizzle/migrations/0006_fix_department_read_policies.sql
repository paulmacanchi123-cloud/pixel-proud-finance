CREATE OR REPLACE FUNCTION public.org_me_can_see_department(_dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ SELECT public.org_is_active_user(auth.uid()) AND (
  public.org_can_read_catalog()
  OR public.org_check(auth.uid(),'departamentos','consultar',NULL,NULL,true)
  OR _dept = public.org_user_dept(auth.uid())) $$;
CREATE OR REPLACE FUNCTION public.org_me_can_see_department_perms(_dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ SELECT public.org_is_active_user(auth.uid()) AND (
  public.org_can_read_catalog() OR _dept = public.org_user_dept(auth.uid())) $$;
REVOKE ALL ON FUNCTION public.org_me_can_see_department(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_me_can_see_department_perms(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_me_can_see_department(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_me_can_see_department_perms(uuid) TO authenticated;
DROP POLICY IF EXISTS "dept read" ON public.departments;
CREATE POLICY "dept read" ON public.departments FOR SELECT TO authenticated
USING (public.org_me_can_see_department(id));
DROP POLICY IF EXISTS "deptperm read" ON public.department_permissions;
CREATE POLICY "deptperm read" ON public.department_permissions FOR SELECT TO authenticated
USING (public.org_me_can_see_department_perms(department_id));