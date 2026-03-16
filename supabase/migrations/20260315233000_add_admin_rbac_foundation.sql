begin;

alter table public.profiles
  add column if not exists admin_level text,
  add column if not exists admin_invited_by_user_id uuid,
  add column if not exists admin_role_changed_by_user_id uuid,
  add column if not exists admin_role_changed_at timestamptz,
  add column if not exists admin_disabled_at timestamptz,
  add column if not exists admin_disabled_by_user_id uuid,
  add column if not exists admin_access_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_admin_level_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_admin_level_check
      check (
        admin_level is null
        or admin_level in (
          'super_admin',
          'admin_ops',
          'kyc_admin',
          'support_admin'
        )
      );
  end if;
end
$$;

create index if not exists idx_profiles_admin_level
  on public.profiles (admin_level);

create index if not exists idx_profiles_admin_invited_by_user_id
  on public.profiles (admin_invited_by_user_id);

create index if not exists idx_profiles_admin_role_changed_by_user_id
  on public.profiles (admin_role_changed_by_user_id);

create index if not exists idx_profiles_admin_disabled_by_user_id
  on public.profiles (admin_disabled_by_user_id);

create index if not exists idx_profiles_admin_disabled_at
  on public.profiles (admin_disabled_at desc);

comment on column public.profiles.admin_level is 'RBAC level for admin users. Broad role stays admin; admin_level controls permission tier.';
comment on column public.profiles.admin_invited_by_user_id is 'User ID of the super admin who created or invited this admin.';
comment on column public.profiles.admin_role_changed_by_user_id is 'User ID of the super admin who last changed this admin access level.';
comment on column public.profiles.admin_role_changed_at is 'Timestamp when admin level or admin access was last changed.';
comment on column public.profiles.admin_disabled_at is 'Timestamp when admin access was disabled.';
comment on column public.profiles.admin_disabled_by_user_id is 'User ID of the super admin who disabled this admin.';
comment on column public.profiles.admin_access_note is 'Internal note about why admin access was granted, changed, or disabled.';

commit;