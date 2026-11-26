CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.has_role(_user_id, 'ceo')
    and exists (select 1 from public.profiles where id = _user_id and status = 'active')
    and (
      auth.uid() is null
      or _user_id = auth.uid()
      or (public.has_role(auth.uid(), 'ceo')
          and exists (select 1 from public.profiles where id = auth.uid() and status = 'active'))
      or public.org_check(auth.uid(), 'usuarios', 'consultar', null, null, true)
      or public.org_check(auth.uid(), 'permisos', 'consultar', null, null, true)
    )
$function$;