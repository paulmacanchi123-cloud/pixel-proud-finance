CREATE TABLE IF NOT EXISTS public.org_authz_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'legacy' CHECK (mode IN ('legacy','shadow','union','org')),
  enforcement_unlocked boolean NOT NULL DEFAULT false,
  require_mfa_admin boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.org_authz_config TO service_role;
ALTER TABLE public.org_authz_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_authz_config FROM public, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.org_legacy_map (
  legacy_perm public.iris_permission PRIMARY KEY,
  resource text REFERENCES public.org_resources(code),
  action public.org_action,
  status text NOT NULL CHECK (status IN ('equivalente','sin_equivalencia')),
  note text NOT NULL DEFAULT '',
  CONSTRAINT org_legacy_map_ck CHECK ((status='equivalente')=(resource IS NOT NULL AND action IS NOT NULL))
);
GRANT SELECT ON public.org_legacy_map TO authenticated;
GRANT ALL ON public.org_legacy_map TO service_role;
ALTER TABLE public.org_legacy_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org legacy map read" ON public.org_legacy_map;
CREATE POLICY "org legacy map read" ON public.org_legacy_map FOR SELECT TO authenticated USING (public.org_can_read_catalog());

CREATE TABLE IF NOT EXISTS public.org_shadow_decisions (
  user_id uuid NOT NULL,
  perm public.iris_permission NOT NULL,
  legacy_result boolean NOT NULL,
  org_result boolean NOT NULL,
  hits bigint NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,perm,legacy_result,org_result)
);
GRANT ALL ON public.org_shadow_decisions TO service_role;
ALTER TABLE public.org_shadow_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_shadow_decisions FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_permission_legacy(_user_id uuid,_perm public.iris_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_user_id AND status='active') THEN false
    WHEN public.has_role(_user_id,'ceo') THEN true
    ELSE coalesce((SELECT granted FROM public.user_permissions WHERE user_id=_user_id AND permission=_perm),
      EXISTS (SELECT 1 FROM public.profiles pr JOIN public.department_permissions dp ON dp.department_id=pr.department_id
              WHERE pr.id=_user_id AND dp.permission=_perm)) END
$$;
REVOKE ALL ON FUNCTION public.has_permission_legacy(uuid,public.iris_permission) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.has_permission_legacy(uuid,public.iris_permission) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.org_permission_mapped(_user_id uuid,_perm public.iris_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_user_id AND status='active') THEN false
    WHEN public.has_role(_user_id,'ceo') THEN true
    ELSE EXISTS (SELECT 1 FROM public.org_legacy_map m WHERE m.legacy_perm=_perm AND m.status='equivalente'
      AND public.org_check(_user_id,m.resource,m.action,NULL,NULL,false)) END
$$;
REVOKE ALL ON FUNCTION public.org_permission_mapped(uuid,public.iris_permission) FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid,_perm public.iris_permission)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m text; legacy boolean; neu boolean;
BEGIN
  SELECT c.mode INTO m FROM public.org_authz_config c WHERE c.id=1;
  legacy:=public.has_permission_legacy(_user_id,_perm);
  IF m IS NULL OR m='legacy' THEN RETURN legacy; END IF;
  neu:=public.org_permission_mapped(_user_id,_perm);
  IF m='shadow' THEN
    IF legacy IS DISTINCT FROM neu THEN
      BEGIN
        INSERT INTO public.org_shadow_decisions(user_id,perm,legacy_result,org_result) VALUES(_user_id,_perm,legacy,neu)
        ON CONFLICT(user_id,perm,legacy_result,org_result) DO UPDATE SET hits=public.org_shadow_decisions.hits+1,last_seen=now();
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;
    RETURN legacy;
  ELSIF m='union' THEN RETURN legacy OR neu;
  ELSE RETURN neu;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.org_get_authz_config()
RETURNS TABLE(mode text,enforcement_unlocked boolean,require_mfa_admin boolean,updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.is_ceo(auth.uid()) THEN RAISE EXCEPTION 'No autorizado' USING errcode='42501'; END IF;
  RETURN QUERY SELECT c.mode,c.enforcement_unlocked,c.require_mfa_admin,c.updated_at FROM public.org_authz_config c WHERE c.id=1;
END $$;

CREATE OR REPLACE FUNCTION public.org_set_authz_mode(_mode text,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=public.org_actor(); old text; unlocked boolean;
BEGIN
  IF NOT public.is_ceo(actor) THEN RAISE EXCEPTION 'Solo el CEO puede cambiar el modo de autorización' USING errcode='42501'; END IF;
  PERFORM public.org_need_reason(_reason);
  IF _mode NOT IN ('legacy','shadow','union','org') THEN RAISE EXCEPTION 'Modo inválido'; END IF;
  SELECT c.mode,c.enforcement_unlocked INTO old,unlocked FROM public.org_authz_config c WHERE c.id=1;
  IF _mode IN ('union','org') AND NOT unlocked THEN
    RAISE EXCEPTION 'Los modos union/org están BLOQUEADOS: requieren aprobación expresa y habilitación por el propietario de la base de datos' USING errcode='42501';
  END IF;
  UPDATE public.org_authz_config SET mode=_mode,updated_by=actor,updated_at=now() WHERE id=1;
  PERFORM public.org_log('authz.modo','configuracion','authz_mode',jsonb_build_object('mode',old),jsonb_build_object('mode',_mode),_reason);
END $$;

CREATE OR REPLACE FUNCTION public.org_set_require_mfa_admin(_on boolean,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=public.org_actor();
BEGIN
  IF NOT public.is_ceo(actor) THEN RAISE EXCEPTION 'Solo el CEO puede cambiar este ajuste' USING errcode='42501'; END IF;
  PERFORM public.org_need_reason(_reason);
  IF _on AND coalesce(auth.jwt()->>'aal','')<>'aal2' THEN
    RAISE EXCEPTION 'Para activar la exigencia de MFA debes iniciar sesión con segundo factor (aal2); así se comprueba que funciona antes de aplicarla' USING errcode='42501';
  END IF;
  UPDATE public.org_authz_config SET require_mfa_admin=_on,updated_by=actor,updated_at=now() WHERE id=1;
  PERFORM public.org_log('authz.mfa_admin','configuracion','require_mfa_admin',NULL,jsonb_build_object('require_mfa_admin',_on),_reason);
END $$;

CREATE OR REPLACE FUNCTION public.org_authz_diff()
RETURNS TABLE(user_id uuid,email text,department_code text,perm public.iris_permission,legacy_result boolean,org_result boolean,legacy_source text,mapped_to text,map_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.is_ceo(auth.uid()) THEN RAISE EXCEPTION 'No autorizado' USING errcode='42501'; END IF;
  RETURN QUERY
    SELECT p.id,p.email,d.code,x,public.has_permission_legacy(p.id,x),public.org_permission_mapped(p.id,x),
      CASE WHEN up.granted IS NOT NULL THEN 'usuario' WHEN dp.permission IS NOT NULL THEN 'departamento' ELSE 'ninguno' END,
      coalesce(m.resource||':'||m.action::text,'—'),m.status
    FROM public.profiles p LEFT JOIN public.departments d ON d.id=p.department_id
    CROSS JOIN unnest(enum_range(NULL::public.iris_permission)) x
    LEFT JOIN public.user_permissions up ON up.user_id=p.id AND up.permission=x
    LEFT JOIN public.department_permissions dp ON dp.department_id=p.department_id AND dp.permission=x
    LEFT JOIN public.org_legacy_map m ON m.legacy_perm=x
    WHERE p.status='active' AND NOT public.has_role(p.id,'ceo')
      AND public.has_permission_legacy(p.id,x) IS DISTINCT FROM public.org_permission_mapped(p.id,x)
    ORDER BY p.email,x;
END $$;

CREATE OR REPLACE FUNCTION public.org_shadow_report()
RETURNS TABLE(user_id uuid,email text,perm public.iris_permission,legacy_result boolean,org_result boolean,hits bigint,first_seen timestamptz,last_seen timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.is_ceo(auth.uid()) THEN RAISE EXCEPTION 'No autorizado' USING errcode='42501'; END IF;
  RETURN QUERY SELECT s.user_id,(SELECT pr.email FROM public.profiles pr WHERE pr.id=s.user_id),s.perm,s.legacy_result,s.org_result,s.hits,s.first_seen,s.last_seen
    FROM public.org_shadow_decisions s ORDER BY s.last_seen DESC;
END $$;

CREATE OR REPLACE FUNCTION public.org_migration_plan()
RETURNS TABLE(user_id uuid,email text,department_code text,legacy_perm public.iris_permission,source text,granted boolean,org_resource text,org_action text,map_status text,proposed_role text,note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.is_ceo(auth.uid()) THEN RAISE EXCEPTION 'No autorizado' USING errcode='42501'; END IF;
  RETURN QUERY
    SELECT p.id,p.email,d.code,x,CASE WHEN up.granted IS NOT NULL THEN 'usuario' ELSE 'departamento' END,
      coalesce(up.granted,dp.permission IS NOT NULL),m.resource,m.action::text,m.status,
      CASE WHEN m.status<>'equivalente' THEN '(sin equivalente seguro)'
           WHEN up.granted=false THEN '(denegación individual)'
           WHEN up.granted IS TRUE AND dp.permission IS NULL THEN 'ajuste_individual'
           ELSE 'base_'||coalesce(d.code,'sin_departamento') END,
      CASE WHEN m.status<>'equivalente' THEN 'Sin equivalencia segura: no se migra; queda denegado en modo org.'
           WHEN up.granted=false THEN 'Se replica como denegación individual (org_user_denies) tras aprobar el plan.'
           WHEN m.legacy_perm='approve_operations' THEN 'Solo visibilidad de solicitudes; la decisión sigue siendo del CEO.'
           WHEN m.legacy_perm='manage_users' THEN 'Solo lectura de perfiles; administrar cuentas sigue siendo del CEO.' ELSE '' END
    FROM public.profiles p LEFT JOIN public.departments d ON d.id=p.department_id
    CROSS JOIN unnest(enum_range(NULL::public.iris_permission)) x
    LEFT JOIN public.user_permissions up ON up.user_id=p.id AND up.permission=x
    LEFT JOIN public.department_permissions dp ON dp.department_id=p.department_id AND dp.permission=x
    LEFT JOIN public.org_legacy_map m ON m.legacy_perm=x
    WHERE p.status='active' AND NOT public.has_role(p.id,'ceo') AND (up.granted IS NOT NULL OR dp.permission IS NOT NULL)
    ORDER BY p.email,x;
END $$;

CREATE OR REPLACE FUNCTION public.org_me_is_ceo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT public.is_ceo(auth.uid()) $$;
CREATE OR REPLACE FUNCTION public.org_me_has_role(_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT public.has_role(auth.uid(),_role) $$;
CREATE OR REPLACE FUNCTION public.org_me_has_permission(_perm public.iris_permission)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT public.has_permission(auth.uid(),_perm) $$;
REVOKE ALL ON FUNCTION public.org_me_is_ceo() FROM public,anon;
REVOKE ALL ON FUNCTION public.org_me_has_role(public.app_role) FROM public,anon;
REVOKE ALL ON FUNCTION public.org_me_has_permission(public.iris_permission) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.org_me_is_ceo() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.org_me_has_role(public.app_role) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.org_me_has_permission(public.iris_permission) TO authenticated,service_role;

ALTER POLICY "approvals create" ON public.approvals WITH CHECK(public.org_me_has_permission('create'));
ALTER POLICY "approvals own read" ON public.approvals USING((requester_id=auth.uid()) OR public.org_me_has_permission('approve_operations'));
ALTER POLICY "approvals ceo decide" ON public.approvals USING(public.org_me_is_ceo()) WITH CHECK(public.org_me_is_ceo());
ALTER POLICY "audit read" ON public.audit_log USING(public.org_me_has_permission('view_audit'));
ALTER POLICY "deptperm ceo delete" ON public.department_permissions USING(public.org_me_is_ceo());
ALTER POLICY "deptperm ceo insert" ON public.department_permissions WITH CHECK(public.org_me_is_ceo() AND department_id<>(SELECT d.id FROM public.departments d WHERE d.code='direccion'));
ALTER POLICY "finance read" ON public.finance_state USING(public.org_me_has_permission('view'));
ALTER POLICY "finance write" ON public.finance_state USING(public.org_me_has_permission('edit')) WITH CHECK(public.org_me_has_permission('edit'));
ALTER POLICY "profile admin read" ON public.profiles USING(public.org_me_is_ceo() OR public.org_me_has_permission('manage_users'));
ALTER POLICY "profile ceo update others" ON public.profiles USING(public.org_me_is_ceo() AND id<>auth.uid()) WITH CHECK(public.org_me_is_ceo() AND id<>auth.uid());
ALTER POLICY "userperm ceo delete" ON public.user_permissions USING(public.org_me_is_ceo() AND user_id<>auth.uid());
ALTER POLICY "userperm ceo insert" ON public.user_permissions WITH CHECK(public.org_me_is_ceo() AND user_id<>auth.uid());
ALTER POLICY "userperm read" ON public.user_permissions USING((user_id=auth.uid()) OR public.org_me_is_ceo());
ALTER POLICY "userperm ceo update" ON public.user_permissions USING(public.org_me_is_ceo() AND user_id<>auth.uid()) WITH CHECK(public.org_me_is_ceo() AND user_id<>auth.uid());
ALTER POLICY "roles self read" ON public.user_roles USING((user_id=auth.uid()) OR public.org_me_is_ceo());

REVOKE ALL ON FUNCTION public.has_permission(uuid,public.iris_permission) FROM public,anon;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM public,anon;
REVOKE ALL ON FUNCTION public.is_ceo(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid,public.iris_permission) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.my_permissions() FROM public,anon;
REVOKE ALL ON FUNCTION public.mark_password_changed() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.bump_finance_version() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_approval_update() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_profile_update() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_approval_requester() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public,anon,authenticated;

CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx ON public.audit_log(actor_id,created_at);
CREATE OR REPLACE FUNCTION public.org_audit_insert(_action text,_target text,_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.audit_log(actor_id,actor_email,action,target,details)
  VALUES(auth.uid(),(SELECT email FROM public.profiles WHERE id=auth.uid()),_action,_target,coalesce(_details,'{}'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.org_audit_insert(text,text,jsonb) FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.write_audit(_action text,_target text,_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF coalesce(_action,'') !~ '^[a-z][a-z_]{1,59}$' THEN RAISE EXCEPTION 'Acción de auditoría no válida (solo minúsculas y «_»; el espacio «org.*» está reservado)' USING errcode='22023'; END IF;
  IF length(coalesce(_target,''))>200 OR pg_column_size(coalesce(_details,'{}'::jsonb))>8192 THEN RAISE EXCEPTION 'Contenido de auditoría demasiado grande' USING errcode='22023'; END IF;
  IF (SELECT count(*) FROM public.audit_log WHERE actor_id=u AND action !~ '\.' AND created_at>now()-interval '1 hour')>=300 THEN RAISE EXCEPTION 'Límite de registros de auditoría por hora alcanzado' USING errcode='54000'; END IF;
  PERFORM public.org_audit_insert(_action,_target,_details);
END $$;
REVOKE ALL ON FUNCTION public.write_audit(text,text,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.write_audit(text,text,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.org_log(_action text,_entity text,_entity_id text,_before jsonb,_after jsonb,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.org_authz_config c WHERE c.id=1 AND c.require_mfa_admin) AND coalesce(auth.jwt()->>'aal','')<>'aal2' THEN
    RAISE EXCEPTION 'Esta operación requiere verificación en dos pasos (MFA)' USING errcode='42501';
  END IF;
  INSERT INTO public.org_change_log(actor_id,actor_email,action,entity,entity_id,before_data,after_data,reason)
  VALUES(auth.uid(),(SELECT email FROM public.profiles WHERE id=auth.uid()),_action,_entity,_entity_id,_before,_after,_reason);
  PERFORM public.org_audit_insert('org.'||_action,_entity||':'||coalesce(_entity_id,''),jsonb_build_object('reason',_reason,'after',_after));
END $$;
REVOKE ALL ON FUNCTION public.org_log(text,text,text,jsonb,jsonb,text) FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.org_log_denied(_action text,_entity text,_entity_id text,_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid();
BEGIN
  IF u IS NULL OR NOT public.org_is_active_user(u) THEN RETURN; END IF;
  IF coalesce(_action,'') !~ '^[a-z_.]{2,60}$' OR coalesce(_entity,'') !~ '^[a-z_]{2,40}$' THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.org_change_log WHERE actor_id=u AND result='denegado' AND created_at>now()-interval '1 hour')>=100 THEN RETURN; END IF;
  INSERT INTO public.org_change_log(actor_id,actor_email,action,entity,entity_id,reason,result)
  VALUES(u,(SELECT email FROM public.profiles WHERE id=u),_action,_entity,left(_entity_id,120),left(coalesce(_error,''),300),'denegado');
  PERFORM public.org_audit_insert('org.'||_action||'.denegado',_entity||':'||coalesce(left(_entity_id,120),''),jsonb_build_object('reason',left(coalesce(_error,''),300)));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['org_get_authz_config()','org_set_authz_mode(text,text)','org_set_require_mfa_admin(boolean,text)','org_authz_diff()','org_shadow_report()','org_migration_plan()','org_log_denied(text,text,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public,anon',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated',f);
  END LOOP;
END $$;

DO $$
DECLARE r record; sp text;
BEGIN
  FOR r IN SELECT p.oid,p.oid::regprocedure AS sig,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e') LOOP
    SELECT option_value INTO sp FROM pg_options_to_table(r.proconfig) WHERE option_name='search_path';
    IF sp IS NULL THEN EXECUTE format('ALTER FUNCTION %s SET search_path=public,pg_temp',r.sig);
    ELSIF sp !~* 'pg_temp\s*$' THEN EXECUTE format('ALTER FUNCTION %s SET search_path=%s,pg_temp',r.sig,sp); END IF;
  END LOOP;
END $$;