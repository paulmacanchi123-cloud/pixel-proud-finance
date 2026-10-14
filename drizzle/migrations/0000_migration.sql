
-- ===== Enums =====
create type public.app_role as enum ('ceo');
create type public.iris_permission as enum (
  'view','create','edit','delete','export','manage_accounts',
  'view_patrimony','manage_investments','approve_operations','manage_users','view_audit'
);
create type public.account_status as enum ('active','suspended','disabled');
create type public.approval_status as enum ('pending','approved','rejected');

-- ===== Departments =====
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.departments to authenticated;
grant all on public.departments to service_role;
alter table public.departments enable row level security;

insert into public.departments (code,name,description,sort_order) values
 ('direccion','Dirección Ejecutiva','CEO de MI POL',1),
 ('administracion','Administración','Gestión administrativa interna',2),
 ('finanzas','Finanzas','Operaciones financieras y contables',3),
 ('rrhh','Recursos Humanos y Personal','Gestión de personal',4),
 ('federales','Federales','Seguridad y supervisión interna de MI POL (función interna, no gubernamental)',5),
 ('civiles','Civiles','Usuarios externos con acceso limitado a servicios autorizados',6);

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  department_id uuid references public.departments(id),
  status public.account_status not null default 'active',
  must_change_password boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ===== Roles =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
-- Only one CEO can ever exist
create unique index one_ceo on public.user_roles (role) where role = 'ceo';

-- ===== Permissions =====
create table public.department_permissions (
  department_id uuid not null references public.departments(id) on delete cascade,
  permission public.iris_permission not null,
  primary key (department_id, permission)
);
grant select, insert, delete on public.department_permissions to authenticated;
grant all on public.department_permissions to service_role;
alter table public.department_permissions enable row level security;

create table public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission public.iris_permission not null,
  granted boolean not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission)
);
grant select, insert, update, delete on public.user_permissions to authenticated;
grant all on public.user_permissions to service_role;
alter table public.user_permissions enable row level security;

-- Least-privilege defaults
insert into public.department_permissions (department_id, permission)
select d.id, p::public.iris_permission from public.departments d,
 unnest(case d.code
   when 'administracion' then array['view','create','edit','export']
   when 'finanzas' then array['view','create','edit','export','manage_accounts','view_patrimony','manage_investments']
   when 'rrhh' then array['view']
   when 'federales' then array['view','view_audit']
   else array[]::text[] end) p
where d.code <> 'direccion';

-- ===== Audit =====
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

-- ===== Finance state (company ledger, preserved original data model) =====
create table public.finance_state (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{"accounts":[],"movements":[],"businesses":[],"investments":[],"receivables":[],"debts":[],"snapshots":[]}'::jsonb,
  version int not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select, update on public.finance_state to authenticated;
grant all on public.finance_state to service_role;
alter table public.finance_state enable row level security;
insert into public.finance_state (id) values (1);

-- ===== Approvals =====
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid(),
  requester_email text,
  operation text not null check (char_length(operation) between 3 and 300),
  amount numeric(14,2) not null check (amount > 0),
  details text not null default '',
  status public.approval_status not null default 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.approvals to authenticated;
grant all on public.approvals to service_role;
alter table public.approvals enable row level security;

-- ===== Helper functions =====
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_ceo(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'ceo')
    and exists (select 1 from public.profiles where id = _user_id and status = 'active')
$$;

create or replace function public.has_permission(_user_id uuid, _perm public.iris_permission)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.profiles where id = _user_id and status = 'active') then false
    when public.has_role(_user_id, 'ceo') then true
    else coalesce(
      (select granted from public.user_permissions where user_id = _user_id and permission = _perm),
      exists (select 1 from public.profiles pr join public.department_permissions dp
              on dp.department_id = pr.department_id
              where pr.id = _user_id and dp.permission = _perm)
    ) end
$$;

create or replace function public.my_permissions()
returns setof public.iris_permission language sql stable security definer set search_path = public as $$
  select p from unnest(enum_range(null::public.iris_permission)) p
  where public.has_permission(auth.uid(), p)
$$;

create or replace function public.write_audit(_action text, _target text, _details jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.audit_log (actor_id, actor_email, action, target, details)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), _action, _target, coalesce(_details,'{}'::jsonb));
end $$;

create or replace function public.mark_password_changed()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set must_change_password = false, updated_at = now() where id = auth.uid();
  perform public.write_audit('password_changed', auth.uid()::text, '{}'::jsonb);
end $$;

-- New auth user -> profile. The designated CEO email becomes CEO only if no CEO exists.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare dir uuid;
begin
  insert into public.profiles (id, email, full_name, department_id, created_by)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name',''),
          (select id from public.departments where code = 'civiles'), null)
  on conflict (id) do nothing;
  if lower(new.email) = 'mipol.company@gmail.com'
     and not exists (select 1 from public.user_roles where role = 'ceo') then
    select id into dir from public.departments where code = 'direccion';
    insert into public.user_roles (user_id, role) values (new.id, 'ceo');
    update public.profiles set department_id = dir, full_name = coalesce(nullif(full_name,''),'CEO MI POL') where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Profile guard: no self-elevation; nobody may move a user into Dirección Ejecutiva; CEO profile can't be suspended
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare dir uuid;
begin
  if auth.uid() is null then return new; end if; -- service role / system
  select id into dir from public.departments where code = 'direccion';
  if new.id = auth.uid() and (new.department_id is distinct from old.department_id or new.status is distinct from old.status
      or new.email is distinct from old.email) then
    raise exception 'No puedes modificar tu propio rol, departamento o estado';
  end if;
  if new.department_id = dir and old.department_id is distinct from dir then
    raise exception 'Dirección Ejecutiva está reservada al CEO';
  end if;
  if public.has_role(new.id, 'ceo') and new.status <> 'active' then
    raise exception 'La cuenta del CEO no puede suspenderse';
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles
for each row execute function public.guard_profile_update();

-- Approval guard: requester can't decide own op; only pending can be decided; fields immutable
create or replace function public.guard_approval_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'pending' then raise exception 'La operación ya fue decidida'; end if;
  if new.requester_id <> old.requester_id or new.amount <> old.amount or new.operation <> old.operation then
    raise exception 'No se pueden alterar los datos de la solicitud';
  end if;
  if auth.uid() = old.requester_id then raise exception 'No puedes aprobar tu propia operación'; end if;
  new.decided_by = auth.uid();
  new.decided_at = now();
  return new;
end $$;
create trigger guard_approval_update before update on public.approvals
for each row execute function public.guard_approval_update();

create or replace function public.set_approval_requester()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.requester_id = auth.uid();
  new.requester_email = (select email from public.profiles where id = auth.uid());
  new.status = 'pending'; new.decided_by = null; new.decided_at = null; new.decision_note = null;
  return new;
end $$;
create trigger set_approval_requester before insert on public.approvals
for each row execute function public.set_approval_requester();

create or replace function public.bump_finance_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(new.data) <> 'object' then raise exception 'Estructura inválida'; end if;
  new.version = old.version + 1; new.updated_by = auth.uid(); new.updated_at = now();
  return new;
end $$;
create trigger bump_finance_version before update on public.finance_state
for each row execute function public.bump_finance_version();

-- ===== Policies =====
create policy "dept read" on public.departments for select to authenticated using (true);

create policy "profile self read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profile admin read" on public.profiles for select to authenticated
  using (public.is_ceo(auth.uid()) or public.has_permission(auth.uid(),'manage_users'));
create policy "profile ceo update others" on public.profiles for update to authenticated
  using (public.is_ceo(auth.uid()) and id <> auth.uid()) with check (public.is_ceo(auth.uid()) and id <> auth.uid());
create policy "profile self name" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "roles self read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_ceo(auth.uid()));

create policy "deptperm read" on public.department_permissions for select to authenticated using (true);
create policy "deptperm ceo insert" on public.department_permissions for insert to authenticated
  with check (public.is_ceo(auth.uid()) and department_id <> (select id from public.departments where code='direccion'));
create policy "deptperm ceo delete" on public.department_permissions for delete to authenticated
  using (public.is_ceo(auth.uid()));

create policy "userperm read" on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or public.is_ceo(auth.uid()));
create policy "userperm ceo insert" on public.user_permissions for insert to authenticated
  with check (public.is_ceo(auth.uid()) and user_id <> auth.uid());
create policy "userperm ceo update" on public.user_permissions for update to authenticated
  using (public.is_ceo(auth.uid()) and user_id <> auth.uid()) with check (public.is_ceo(auth.uid()) and user_id <> auth.uid());
create policy "userperm ceo delete" on public.user_permissions for delete to authenticated
  using (public.is_ceo(auth.uid()) and user_id <> auth.uid());

create policy "audit read" on public.audit_log for select to authenticated
  using (public.has_permission(auth.uid(),'view_audit'));

create policy "finance read" on public.finance_state for select to authenticated
  using (public.has_permission(auth.uid(),'view'));
create policy "finance write" on public.finance_state for update to authenticated
  using (public.has_permission(auth.uid(),'edit')) with check (public.has_permission(auth.uid(),'edit'));

create policy "approvals own read" on public.approvals for select to authenticated
  using (requester_id = auth.uid() or public.has_permission(auth.uid(),'approve_operations'));
create policy "approvals create" on public.approvals for insert to authenticated
  with check (public.has_permission(auth.uid(),'create'));
create policy "approvals ceo decide" on public.approvals for update to authenticated
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

revoke execute on function public.handle_new_user() from public, anon, authenticated;
