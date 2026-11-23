-- =============================================================================
-- IRIS · Módulo Organización  ·  MIGRACIÓN 3/3: DATOS INICIALES (todo configurable)
-- Idempotente (on conflict do nothing). Única modificación de datos existentes: asigna
-- departments.parent_id (jerarquía) donde esté vacío; no renombra ni borra nada.
-- Principio: un cargo NO concede permisos; los permisos salen de roles asignados
-- explícitamente. Los importes/umbrales NO se inventan: quedan "pendiente de
-- configuración" (org_sod_policies.amount_threshold = NULL → aplica a todo importe).
-- =============================================================================

-- ---------- Recursos y permisos (recurso · acción · alcance) ----------
insert into public.org_resources (code, name, description, allowed_actions, allowed_scopes, sort_order) values
 ('usuarios',      'Usuarios',       'Cuentas y datos del personal',               '{consultar,crear,editar,eliminar,exportar,administrar}', '{global,departamento,propio}', 1),
 ('departamentos', 'Departamentos',  'Estructura organizacional',                  '{consultar,crear,editar,administrar}',                    '{global,departamento}', 2),
 ('cargos',        'Cargos',         'Catálogo de cargos y asignaciones',          '{consultar,crear,editar,administrar}',                    '{global,departamento}', 3),
 ('roles',         'Roles',          'Roles funcionales y sus asignaciones',       '{consultar,crear,editar,eliminar,administrar}',           '{global}', 4),
 ('permisos',      'Permisos',       'Matriz de permisos y denegaciones',          '{consultar,editar,administrar}',                          '{global}', 5),
 ('finanzas',      'Finanzas',       'Información y cuentas financieras',          '{consultar,crear,editar,exportar}',                       '{global,departamento}', 6),
 ('presupuestos',  'Presupuestos',   'Presupuestos y su aprobación',               '{consultar,crear,editar,aprobar}',                        '{global,departamento}', 7),
 ('transacciones', 'Transacciones',  'Movimientos y operaciones sensibles',        '{consultar,crear,editar,aprobar,exportar}',               '{global,departamento,propio}', 8),
 ('ventas',        'Ventas',         'Operaciones comerciales',                    '{consultar,crear,editar,eliminar,exportar}',              '{global,departamento,propio}', 9),
 ('compras',       'Compras',        'Compras y proveedores',                      '{consultar,crear,editar,aprobar,exportar}',               '{global,departamento,propio}', 10),
 ('inventario',    'Inventario',     'Existencias y almacén',                      '{consultar,crear,editar,exportar}',                       '{global,departamento}', 11),
 ('reportes',      'Reportes',       'Informes y salidas de información',          '{consultar,crear,exportar}',                              '{global,departamento,propio}', 12),
 ('auditoria',     'Auditoría',      'Evidencias y registros de auditoría',        '{consultar,exportar,auditar}',                            '{global}', 13),
 ('seguridad',     'Seguridad',      'Controles y accesos técnicos',               '{consultar,administrar}',                                 '{global}', 14),
 ('configuracion', 'Configuración',  'Parámetros del sistema',                     '{consultar,editar,administrar}',                          '{global}', 15)
on conflict (code) do nothing;

insert into public.org_permissions (resource, action, scope, is_sensitive)
select r.code, a, s, a in ('aprobar','exportar','administrar','auditar','eliminar')
from public.org_resources r, unnest(r.allowed_actions) a, unnest(r.allowed_scopes) s
on conflict (resource, action, scope) do nothing;

-- ---------- Departamentos iniciales (los existentes se conservan; se añaden los que faltan) ----------
-- Existentes en IRIS: direccion, administracion, finanzas, rrhh, federales, civiles.
insert into public.departments (code, name, description, sort_order) values
 ('riesgos',     'Riesgos y Cumplimiento',          'Supervisión de controles, riesgos e incidencias',     20),
 ('auditoria',   'Auditoría Interna',               'Revisión independiente y custodia de evidencias',     21),
 ('comercial',   'Comercial y Ventas',              'Gestión comercial y ventas',                          22),
 ('operaciones', 'Operaciones y Compras',           'Proveedores, inventario y compras autorizadas',       23),
 ('tecnologia',  'Tecnología y Seguridad Informática','Administración técnica y seguridad',                24),
 ('legal',       'Legal y Administración',          'Documentación, contratos y gestión administrativa',   25)
on conflict (code) do nothing;

-- Jerarquía por defecto: todo cuelga de Dirección Ejecutiva, salvo 'civiles' (usuarios externos).
update public.departments d set parent_id = (select id from public.departments where code = 'direccion')
where d.parent_id is null and d.code not in ('direccion', 'civiles');

-- ---------- Roles funcionales ----------
insert into public.org_roles (code, name, description, is_system, is_privileged) values
 ('administrador_organizacion','Administrador de organización','Delegación de la administración de departamentos, cargos, roles y permisos. Sin acceso a finanzas ni auditoría.', true, true),
 ('admin_tecnico',        'Administración técnica',       'Cuentas, seguridad y configuración técnica. Sin aprobación financiera ni auditoría.', true, true),
 ('director_ejecutivo',   'Dirección ejecutiva',          'Supervisión global de lectura sobre la organización y la información de gestión.', true, false),
 ('director_area',        'Dirección de área',            'Supervisión de lectura de su departamento; decisiones delegadas solo por asignación expresa.', false, false),
 ('gerente',              'Gerencia',                     'Gestión operativa de su departamento.', false, false),
 ('subgerente',           'Subgerencia',                  'Funciones delegadas; las sustituciones se otorgan con vigencia temporal.', false, false),
 ('operador_financiero',  'Gestión financiera',           'Gestión financiera y conciliaciones. NO aprueba.', true, false),
 ('aprobador_financiero', 'Aprobación financiera',        'Aprueba operaciones y presupuestos. Incompatible con gestionar, contabilizar o auditar.', true, false),
 ('contador',             'Contabilidad',                 'Registro y revisión contable.', true, false),
 ('supervisor_riesgos',   'Supervisión de riesgos y cumplimiento', 'Supervisión de controles e incidencias (lectura).', true, false),
 ('auditor_interno',      'Auditoría interna',            'Consulta de evidencias y revisión independiente (solo lectura).', true, false),
 ('gestor_comercial',     'Gestión comercial',            'Gestión comercial dentro de su departamento.', false, false),
 ('vendedor',             'Vendedor',                     'Operaciones comerciales propias.', false, false),
 ('gestor_operaciones',   'Gestión de operaciones y compras', 'Proveedores, inventario y compras de su departamento.', false, false),
 ('gestor_talento_humano','Gestión de talento humano',    'Administración restringida de información del personal.', true, false),
 ('gestor_legal_admin',   'Gestión legal y administrativa','Documentación y gestión administrativa autorizada.', false, false),
 ('socio',                'Socio',                        'Información correspondiente a sus derechos (solo registros propios).', false, false),
 ('inversionista',        'Inversionista',                'Información expresamente autorizada (solo registros propios).', false, false)
on conflict (code) do nothing;

-- ---------- Permisos por rol (matriz inicial; ver docs/MATRIZ_CARGOS_PERMISOS.md) ----------
drop table if exists pg_temp._seed_rp;
create temporary table _seed_rp (role_code text, resource text, action public.org_action, scope public.org_scope);
insert into _seed_rp values
 -- administrador_organizacion
 ('administrador_organizacion','departamentos','consultar','global'),('administrador_organizacion','departamentos','administrar','global'),
 ('administrador_organizacion','cargos','consultar','global'),('administrador_organizacion','cargos','administrar','global'),
 ('administrador_organizacion','roles','consultar','global'),('administrador_organizacion','roles','administrar','global'),
 ('administrador_organizacion','permisos','consultar','global'),('administrador_organizacion','permisos','administrar','global'),
 ('administrador_organizacion','usuarios','consultar','global'),
 -- admin_tecnico
 ('admin_tecnico','usuarios','consultar','global'),('admin_tecnico','usuarios','crear','global'),('admin_tecnico','usuarios','editar','global'),
 ('admin_tecnico','seguridad','consultar','global'),('admin_tecnico','seguridad','administrar','global'),
 ('admin_tecnico','configuracion','consultar','global'),('admin_tecnico','configuracion','editar','global'),('admin_tecnico','configuracion','administrar','global'),
 -- director_ejecutivo
 ('director_ejecutivo','departamentos','consultar','global'),('director_ejecutivo','cargos','consultar','global'),('director_ejecutivo','usuarios','consultar','global'),
 ('director_ejecutivo','finanzas','consultar','global'),('director_ejecutivo','presupuestos','consultar','global'),('director_ejecutivo','transacciones','consultar','global'),
 ('director_ejecutivo','ventas','consultar','global'),('director_ejecutivo','compras','consultar','global'),('director_ejecutivo','inventario','consultar','global'),
 ('director_ejecutivo','reportes','consultar','global'),('director_ejecutivo','reportes','exportar','global'),
 -- director_area
 ('director_area','departamentos','consultar','global'),('director_area','cargos','consultar','global'),('director_area','usuarios','consultar','departamento'),
 ('director_area','finanzas','consultar','departamento'),('director_area','presupuestos','consultar','departamento'),('director_area','transacciones','consultar','departamento'),
 ('director_area','ventas','consultar','departamento'),('director_area','compras','consultar','departamento'),('director_area','inventario','consultar','departamento'),
 ('director_area','reportes','consultar','departamento'),('director_area','reportes','exportar','departamento'),
 -- gerente
 ('gerente','usuarios','consultar','departamento'),('gerente','presupuestos','consultar','departamento'),('gerente','transacciones','consultar','departamento'),
 ('gerente','ventas','consultar','departamento'),('gerente','ventas','crear','departamento'),('gerente','ventas','editar','departamento'),
 ('gerente','compras','consultar','departamento'),('gerente','compras','crear','departamento'),('gerente','compras','editar','departamento'),
 ('gerente','inventario','consultar','departamento'),('gerente','inventario','crear','departamento'),('gerente','inventario','editar','departamento'),
 ('gerente','reportes','consultar','departamento'),('gerente','reportes','crear','departamento'),('gerente','reportes','exportar','departamento'),
 -- subgerente
 ('subgerente','usuarios','consultar','departamento'),('subgerente','presupuestos','consultar','departamento'),
 ('subgerente','ventas','consultar','departamento'),('subgerente','ventas','crear','departamento'),
 ('subgerente','compras','consultar','departamento'),('subgerente','compras','crear','departamento'),
 ('subgerente','inventario','consultar','departamento'),('subgerente','inventario','crear','departamento'),
 ('subgerente','reportes','consultar','departamento'),
 -- operador_financiero (NO aprueba)
 ('operador_financiero','finanzas','consultar','global'),('operador_financiero','finanzas','crear','global'),('operador_financiero','finanzas','editar','global'),('operador_financiero','finanzas','exportar','global'),
 ('operador_financiero','transacciones','consultar','global'),('operador_financiero','transacciones','crear','global'),('operador_financiero','transacciones','editar','global'),
 ('operador_financiero','presupuestos','consultar','global'),('operador_financiero','presupuestos','crear','global'),('operador_financiero','presupuestos','editar','global'),
 ('operador_financiero','reportes','consultar','global'),('operador_financiero','reportes','crear','global'),('operador_financiero','reportes','exportar','global'),
 -- aprobador_financiero
 ('aprobador_financiero','finanzas','consultar','global'),('aprobador_financiero','transacciones','consultar','global'),('aprobador_financiero','transacciones','aprobar','global'),
 ('aprobador_financiero','presupuestos','consultar','global'),('aprobador_financiero','presupuestos','aprobar','global'),
 ('aprobador_financiero','compras','consultar','global'),('aprobador_financiero','compras','aprobar','global'),('aprobador_financiero','reportes','consultar','global'),
 -- contador
 ('contador','finanzas','consultar','global'),('contador','transacciones','consultar','global'),('contador','transacciones','crear','global'),('contador','transacciones','editar','global'),
 ('contador','presupuestos','consultar','global'),
 ('contador','reportes','consultar','global'),('contador','reportes','crear','global'),('contador','reportes','exportar','global'),
 -- supervisor_riesgos
 ('supervisor_riesgos','auditoria','consultar','global'),('supervisor_riesgos','seguridad','consultar','global'),
 ('supervisor_riesgos','finanzas','consultar','global'),('supervisor_riesgos','transacciones','consultar','global'),
 ('supervisor_riesgos','usuarios','consultar','global'),('supervisor_riesgos','roles','consultar','global'),('supervisor_riesgos','permisos','consultar','global'),
 ('supervisor_riesgos','reportes','consultar','global'),('supervisor_riesgos','reportes','crear','global'),('supervisor_riesgos','reportes','exportar','global'),
 -- auditor_interno (solo lectura + auditar/exportar evidencias)
 ('auditor_interno','auditoria','consultar','global'),('auditor_interno','auditoria','exportar','global'),('auditor_interno','auditoria','auditar','global'),
 ('auditor_interno','finanzas','consultar','global'),('auditor_interno','presupuestos','consultar','global'),('auditor_interno','transacciones','consultar','global'),
 ('auditor_interno','ventas','consultar','global'),('auditor_interno','compras','consultar','global'),('auditor_interno','inventario','consultar','global'),
 ('auditor_interno','reportes','consultar','global'),('auditor_interno','reportes','exportar','global'),
 ('auditor_interno','usuarios','consultar','global'),('auditor_interno','roles','consultar','global'),('auditor_interno','permisos','consultar','global'),
 ('auditor_interno','seguridad','consultar','global'),
 -- gestor_comercial
 ('gestor_comercial','usuarios','consultar','departamento'),
 ('gestor_comercial','ventas','consultar','departamento'),('gestor_comercial','ventas','crear','departamento'),('gestor_comercial','ventas','editar','departamento'),('gestor_comercial','ventas','exportar','departamento'),
 ('gestor_comercial','reportes','consultar','departamento'),('gestor_comercial','reportes','crear','departamento'),('gestor_comercial','reportes','exportar','departamento'),
 -- vendedor (solo lo propio)
 ('vendedor','ventas','consultar','propio'),('vendedor','ventas','crear','propio'),('vendedor','ventas','editar','propio'),('vendedor','reportes','consultar','propio'),
 -- gestor_operaciones
 ('gestor_operaciones','compras','consultar','departamento'),('gestor_operaciones','compras','crear','departamento'),('gestor_operaciones','compras','editar','departamento'),
 ('gestor_operaciones','inventario','consultar','departamento'),('gestor_operaciones','inventario','crear','departamento'),('gestor_operaciones','inventario','editar','departamento'),
 ('gestor_operaciones','reportes','consultar','departamento'),('gestor_operaciones','reportes','crear','departamento'),
 -- gestor_talento_humano
 ('gestor_talento_humano','usuarios','consultar','global'),('gestor_talento_humano','usuarios','editar','departamento'),('gestor_talento_humano','reportes','consultar','departamento'),
 -- gestor_legal_admin
 ('gestor_legal_admin','departamentos','consultar','global'),('gestor_legal_admin','cargos','consultar','global'),('gestor_legal_admin','configuracion','consultar','global'),
 ('gestor_legal_admin','reportes','consultar','departamento'),('gestor_legal_admin','reportes','crear','departamento'),('gestor_legal_admin','reportes','exportar','departamento'),
 -- socio / inversionista (solo registros propios; ampliar exige asignación expresa)
 ('socio','reportes','consultar','propio'),('inversionista','reportes','consultar','propio');

do $$
declare expected int; inserted int;
begin
  select count(*) into expected from _seed_rp;
  insert into public.org_role_permissions (role_id, permission_id)
  select r.id, p.id from _seed_rp s
  join public.org_roles r on r.code = s.role_code
  join public.org_permissions p on p.resource = s.resource and p.action = s.action and p.scope = s.scope
  on conflict do nothing;
  get diagnostics inserted = row_count;
  -- Verifica que ninguna fila semilla quedó sin resolver (recurso/acción/alcance inexistente)
  if (select count(*) from _seed_rp s
        join public.org_roles r on r.code = s.role_code
        join public.org_permissions p on p.resource = s.resource and p.action = s.action and p.scope = s.scope) <> expected then
    raise exception 'Semilla inconsistente: hay permisos de rol que no existen en el catálogo';
  end if;
end $$;

drop table if exists pg_temp._seed_rp;

-- ---------- Cargos iniciales (autoridad organizacional; jerarquía configurable) ----------
insert into public.org_positions (code, name, description, department_id, is_external, sort_order, responsibilities) values
 ('ceo','CEO','Máxima autoridad ejecutiva de MI POL.',(select id from public.departments where code='direccion'),false,1,
   array['Dirección ejecutiva','Supervisión global conforme a las facultades autorizadas','Aprobación de operaciones sensibles']),
 ('director_ejecutivo','Director ejecutivo','Dirección ejecutiva delegada.',(select id from public.departments where code='direccion'),false,2,
   array['Supervisión de gestión','Coordinación entre áreas']),
 ('director_area','Director de área','Dirección de un área o departamento.',null,false,3,
   array['Supervisión de su área','Decisiones expresamente delegadas']),
 ('gerente','Gerente','Gestión operativa de un departamento.',null,false,4,
   array['Gestión operativa del departamento']),
 ('subgerente','Subgerente','Funciones delegadas y sustituciones autorizadas.',null,false,5,
   array['Funciones delegadas','Sustituciones autorizadas']),
 ('responsable_financiero','Responsable financiero','Gestión financiera.',(select id from public.departments where code='finanzas'),false,6,
   array['Gestión financiera','Conciliaciones según sus facultades']),
 ('contador','Contador','Registro y revisión contable.',(select id from public.departments where code='finanzas'),false,7,
   array['Registro contable','Revisión contable']),
 ('responsable_riesgos','Responsable de riesgos y cumplimiento','Supervisión de controles e incidencias.',(select id from public.departments where code='riesgos'),false,8,
   array['Supervisión de controles','Gestión de incidencias']),
 ('auditor_interno','Auditor interno','Revisión independiente.',(select id from public.departments where code='auditoria'),false,9,
   array['Consulta de evidencias','Revisión independiente']),
 ('responsable_tecnologia','Responsable de tecnología y seguridad','Administración técnica.',(select id from public.departments where code='tecnologia'),false,10,
   array['Administración técnica','Accesos técnicos autorizados']),
 ('responsable_comercial','Responsable comercial','Gestión comercial.',(select id from public.departments where code='comercial'),false,11,
   array['Gestión comercial dentro del alcance permitido']),
 ('vendedor','Vendedor','Operaciones comerciales propias.',(select id from public.departments where code='comercial'),false,12,
   array['Operaciones comerciales propias','Funciones delegadas']),
 ('responsable_operaciones','Responsable de operaciones y compras','Proveedores, inventario y compras.',(select id from public.departments where code='operaciones'),false,13,
   array['Proveedores','Inventario','Compras autorizadas']),
 ('responsable_talento_humano','Responsable de talento humano','Administración del personal.',(select id from public.departments where code='rrhh'),false,14,
   array['Administración restringida de información del personal']),
 ('responsable_legal_admin','Responsable legal y administrativo','Documentación y contratos autorizados.',(select id from public.departments where code='legal'),false,15,
   array['Documentación','Contratos autorizados']),
 ('socio','Socio','Socio de MI POL (externo a la línea jerárquica).',null,true,16,
   array['Información correspondiente a sus derechos y facultades']),
 ('inversionista','Inversionista','Inversionista (externo a la línea jerárquica).',null,true,17,
   array['Información expresamente autorizada'])
on conflict (code) do nothing;

-- Jerarquía por defecto (autoridad organizacional; NO implica herencia de permisos)
update public.org_positions c set reports_to_id = (select id from public.org_positions where code = m.sup)
from (values
  ('director_ejecutivo','ceo'),('responsable_riesgos','ceo'),('auditor_interno','ceo'),
  ('director_area','director_ejecutivo'),('responsable_financiero','director_ejecutivo'),
  ('responsable_tecnologia','director_ejecutivo'),('responsable_comercial','director_ejecutivo'),
  ('responsable_operaciones','director_ejecutivo'),('responsable_talento_humano','director_ejecutivo'),
  ('responsable_legal_admin','director_ejecutivo'),
  ('gerente','director_area'),('subgerente','gerente'),
  ('contador','responsable_financiero'),('vendedor','responsable_comercial')
) as m(code, sup)
where c.code = m.code and c.reports_to_id is null;

-- Roles SUGERIDOS por cargo (plantilla; aplicarlos es una acción explícita y auditada)
insert into public.org_position_roles (position_id, role_id)
select p.id, r.id from (values
  ('director_ejecutivo','director_ejecutivo'),('director_area','director_area'),('gerente','gerente'),('subgerente','subgerente'),
  ('responsable_financiero','operador_financiero'),('contador','contador'),
  ('responsable_riesgos','supervisor_riesgos'),('auditor_interno','auditor_interno'),
  ('responsable_tecnologia','admin_tecnico'),('responsable_comercial','gestor_comercial'),('vendedor','vendedor'),
  ('responsable_operaciones','gestor_operaciones'),('responsable_talento_humano','gestor_talento_humano'),
  ('responsable_legal_admin','gestor_legal_admin'),('socio','socio'),('inversionista','inversionista')
) as m(pos, role)
join public.org_positions p on p.code = m.pos join public.org_roles r on r.code = m.role
on conflict do nothing;

-- ---------- Reglas de incompatibilidad de funciones ----------
insert into public.org_sod_rules (role_a_id, role_b_id, description, severity)
select a.id, b.id, m.d, m.sev from (values
  ('operador_financiero','aprobador_financiero','Quien gestiona operaciones financieras no puede aprobarlas','alta'),
  ('contador','aprobador_financiero','Quien registra contabilidad no puede aprobar las operaciones','alta'),
  ('operador_financiero','auditor_interno','La auditoría debe ser independiente de la gestión financiera','alta'),
  ('contador','auditor_interno','La auditoría debe ser independiente de la contabilidad','alta'),
  ('aprobador_financiero','auditor_interno','La auditoría debe ser independiente de la aprobación','alta'),
  ('admin_tecnico','aprobador_financiero','La administración técnica no puede aprobar operaciones financieras','alta'),
  ('admin_tecnico','operador_financiero','La administración técnica no puede gestionar operaciones financieras','alta'),
  ('admin_tecnico','auditor_interno','La administración técnica no puede auditarse a sí misma','alta'),
  ('administrador_organizacion','auditor_interno','Quien administra roles no puede auditar esos cambios','alta'),
  ('administrador_organizacion','aprobador_financiero','Quien administra accesos no puede aprobar operaciones financieras','alta'),
  ('administrador_organizacion','operador_financiero','Quien administra accesos no puede gestionar operaciones financieras','alta'),
  ('gestor_operaciones','aprobador_financiero','Quien solicita compras no puede aprobarlas','alta'),
  ('gestor_talento_humano','admin_tecnico','Datos de personal y administración técnica deben estar separados','media'),
  ('supervisor_riesgos','auditor_interno','Segunda y tercera línea de control deben estar separadas','media')
) as m(ra, rb, d, sev)
join public.org_roles a on a.code = m.ra join public.org_roles b on b.code = m.rb
on conflict do nothing;

-- ---------- Políticas de operaciones sensibles (solicitar / aprobar / ejecutar) ----------
-- amount_threshold NULL = «pendiente de configuración» por MI POL: se aplica a TODO importe.
insert into public.org_sod_policies (code, name, description, steps) values
 ('transaccion_sensible','Transacción financiera sensible','Quien solicita no aprueba ni ejecuta la misma operación.',
   '[{"step":"solicitar","resource":"transacciones","action":"crear"},{"step":"aprobar","resource":"transacciones","action":"aprobar"},{"step":"ejecutar","resource":"transacciones","action":"editar"}]'::jsonb),
 ('presupuesto','Presupuesto','Quien elabora un presupuesto no lo aprueba.',
   '[{"step":"solicitar","resource":"presupuestos","action":"crear"},{"step":"aprobar","resource":"presupuestos","action":"aprobar"}]'::jsonb),
 ('compra','Compra','Quien solicita una compra no la aprueba ni la ejecuta.',
   '[{"step":"solicitar","resource":"compras","action":"crear"},{"step":"aprobar","resource":"compras","action":"aprobar"},{"step":"ejecutar","resource":"compras","action":"editar"}]'::jsonb)
on conflict (code) do nothing;

-- Recursos sensibles independientes: Finanzas no concede Patrimonio, Inversiones ni Cuentas.
insert into public.org_resources (code, name, description, allowed_actions, allowed_scopes, sort_order) values
 ('patrimonio','Patrimonio','Patrimonio neto y su tendencia (información sensible)','{consultar}','{global}',16),
 ('inversiones','Inversiones','Cartera de inversiones','{consultar,editar}','{global}',17),
 ('cuentas','Cuentas','Administración de cuentas financieras','{administrar}','{global}',18)
on conflict (code) do nothing;

insert into public.org_permissions (resource, action, scope, is_sensitive)
select r.code, a, s, true
from public.org_resources r, unnest(r.allowed_actions) a, unnest(r.allowed_scopes) s
where r.code in ('patrimonio','inversiones','cuentas')
on conflict (resource, action, scope) do nothing;
update public.org_permissions set is_sensitive = true where resource in ('patrimonio','inversiones','cuentas');

update public.org_roles set
  name = 'Visibilidad de aprobaciones',
  description = 'Permite ver las solicitudes de aprobación. La decisión (aprobar/rechazar) sigue reservada al CEO; no se habilitan aprobadores delegados ni límites de importe.'
where code = 'aprobador_financiero' and description like 'Aprueba operaciones%';

insert into public.org_authz_config (id) values (1) on conflict (id) do nothing;

insert into public.org_legacy_map (legacy_perm, resource, action, status, note) values
 ('view','finanzas','consultar','equivalente','Lectura de finance_state y datos generales de Finanzas.'),
 ('edit','finanzas','editar','equivalente','Escritura de finance_state (registro único: solo alcance global).'),
 ('export','finanzas','exportar','equivalente','Exportación desde Finanzas.'),
 ('create','transacciones','crear','equivalente','Hoy solo habilita crear solicitudes de aprobación.'),
 ('approve_operations','transacciones','aprobar','equivalente','Solo concede VER solicitudes. La decisión sigue reservada al CEO.'),
 ('view_audit','auditoria','consultar','equivalente','Lectura de audit_log.'),
 ('manage_users','usuarios','consultar','equivalente','Solo concede LEER perfiles. Crear/suspender/mover usuarios sigue siendo exclusivo del CEO.'),
 ('view_patrimony','patrimonio','consultar','equivalente','Recurso independiente.'),
 ('manage_investments','inversiones','editar','equivalente','Recurso independiente. Sin uso actual en el código.'),
 ('manage_accounts','cuentas','administrar','equivalente','Recurso independiente. Sin uso actual en el código.'),
 ('delete',null,null,'sin_equivalencia','Ningún recurso actual admite eliminar finanzas con seguridad; en modo org queda DENEGADO (solo CEO).')
on conflict (legacy_perm) do nothing;
