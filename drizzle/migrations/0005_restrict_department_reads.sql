DROP POLICY IF EXISTS "dept read" ON public.departments;
CREATE POLICY "dept read" ON public.departments FOR SELECT TO authenticated
USING (public.org_is_active_user(auth.uid()) AND (
  public.org_can_read_catalog()
  OR public.org_check(auth.uid(),'departamentos','consultar',NULL,NULL,true)
  OR id = public.org_user_dept(auth.uid())));
DROP POLICY IF EXISTS "deptperm read" ON public.department_permissions;
CREATE POLICY "deptperm read" ON public.department_permissions FOR SELECT TO authenticated
USING (public.org_is_active_user(auth.uid()) AND (
  public.org_can_read_catalog()
  OR department_id = public.org_user_dept(auth.uid())));