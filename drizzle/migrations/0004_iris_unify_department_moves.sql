ALTER TABLE public.org_user_roles
  ADD COLUMN IF NOT EXISTS department_is_explicit boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.org_user_roles.department_is_explicit IS 'false = el alcance departamental acompaña al perfil; true = alcance elegido expresamente y conservado al trasladar a la persona';

CREATE OR REPLACE FUNCTION public.org_assign_role(_user uuid,_role uuid,_department uuid,_valid_until timestamptz,_justification text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=public.org_assert_admin('roles'); eff_dept uuid; has_dept boolean; nid uuid; c record;
BEGIN
  IF _user=actor THEN RAISE EXCEPTION 'No puedes asignarte roles a ti mismo'; END IF;
  IF char_length(btrim(coalesce(_justification,'')))<10 THEN RAISE EXCEPTION 'La justificación debe tener al menos 10 caracteres'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=_user FOR UPDATE;
  IF NOT public.org_is_active_user(_user) THEN RAISE EXCEPTION 'El usuario destino no está activo'; END IF;
  IF public.is_ceo(_user) THEN RAISE EXCEPTION 'El CEO no requiere roles funcionales'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.org_roles WHERE id=_role AND is_active) THEN RAISE EXCEPTION 'Rol no encontrado o inactivo'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until<=now() THEN RAISE EXCEPTION 'La vigencia debe ser futura'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.org_role_permissions rp JOIN public.org_permissions p ON p.id=rp.permission_id WHERE rp.role_id=_role AND p.scope='departamento') INTO has_dept;
  eff_dept:=CASE WHEN has_dept THEN coalesce(_department,public.org_user_dept(_user)) END;
  IF has_dept AND eff_dept IS NULL THEN RAISE EXCEPTION 'El rol tiene alcance departamental: indica un departamento'; END IF;
  IF eff_dept IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.departments WHERE id=eff_dept AND is_active) THEN RAISE EXCEPTION 'Departamento inválido o inactivo'; END IF;
  FOR c IN SELECT * FROM public.org_sod_conflicts_if(_user,array[_role]) LOOP
    RAISE EXCEPTION 'Conflicto de funciones (%): %. Requiere una excepción aprobada por el CEO.',c.severity,c.description;
  END LOOP;
  INSERT INTO public.org_user_roles(user_id,role_id,department_id,department_is_explicit,justification,valid_until,granted_by)
  VALUES(_user,_role,eff_dept,has_dept AND _department IS NOT NULL,btrim(_justification),_valid_until,actor) RETURNING id INTO nid;
  PERFORM public.org_log('rol.asignar','usuario',_user::text,NULL,jsonb_build_object('role_id',_role,'assignment_id',nid,'department_id',eff_dept,'department_is_explicit',has_dept AND _department IS NOT NULL,'valid_until',_valid_until),_justification);
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.org_set_user_department(_user uuid,_department uuid,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=public.org_assert_admin('departamentos'); old_dept uuid; d public.departments; moved_roles int;
BEGIN
  PERFORM public.org_need_reason(_reason);
  IF _user=actor THEN RAISE EXCEPTION 'No puedes modificar tu propio departamento'; END IF;
  SELECT * INTO d FROM public.departments WHERE id=_department AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Departamento no encontrado o inactivo'; END IF;
  IF d.code='direccion' AND NOT public.is_ceo(_user) THEN RAISE EXCEPTION 'Dirección Ejecutiva está reservada al CEO'; END IF;
  SELECT department_id INTO old_dept FROM public.profiles WHERE id=_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
  IF old_dept IS NOT DISTINCT FROM _department THEN RAISE EXCEPTION 'La persona ya pertenece a ese departamento'; END IF;
  UPDATE public.profiles SET department_id=_department WHERE id=_user;
  UPDATE public.departments SET head_user_id=NULL,updated_at=now() WHERE id=old_dept AND head_user_id=_user;
  UPDATE public.org_user_roles SET department_id=_department
  WHERE user_id=_user AND revoked_at IS NULL AND department_is_explicit=false AND department_id IS NOT NULL
    AND (valid_until IS NULL OR valid_until>now());
  GET DIAGNOSTICS moved_roles=ROW_COUNT;
  PERFORM public.org_log('usuario.departamento','usuario',_user::text,
    jsonb_build_object('department_id',old_dept),
    jsonb_build_object('department_id',_department,'profile_linked_roles_updated',moved_roles),_reason);
END $$;