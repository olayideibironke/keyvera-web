begin;

alter table public.profiles
  add column if not exists admin_access_status text,
  add column if not exists admin_approved_by_user_id uuid,
  add column if not exists admin_approved_at timestamptz,
  add column if not exists admin_invitation_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_admin_access_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_admin_access_status_check
      check (
        admin_access_status is null
        or admin_access_status in (
          'pending_owner_approval',
          'active',
          'disabled',
          'revoked'
        )
      );
  end if;
end
$$;

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_admin_level text not null,
  invited_by_user_id uuid not null,
  invite_token uuid not null default gen_random_uuid(),
  invite_status text not null default 'sent',
  owner_approval_required boolean not null default true,
  approved_by_user_id uuid,
  approved_at timestamptz,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  revoked_by_user_id uuid,
  revoked_at timestamptz,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_invitations_invited_admin_level_check'
      and conrelid = 'public.admin_invitations'::regclass
  ) then
    alter table public.admin_invitations
      add constraint admin_invitations_invited_admin_level_check
      check (
        invited_admin_level in (
          'super_admin',
          'admin_ops',
          'kyc_admin',
          'support_admin'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_invitations_invite_status_check'
      and conrelid = 'public.admin_invitations'::regclass
  ) then
    alter table public.admin_invitations
      add constraint admin_invitations_invite_status_check
      check (
        invite_status in (
          'sent',
          'accepted',
          'approved',
          'revoked',
          'expired'
        )
      );
  end if;
end
$$;

create unique index if not exists idx_admin_invitations_invite_token
  on public.admin_invitations (invite_token);

create index if not exists idx_admin_invitations_email
  on public.admin_invitations (lower(email));

create index if not exists idx_admin_invitations_status
  on public.admin_invitations (invite_status);

create index if not exists idx_admin_invitations_invited_by_user_id
  on public.admin_invitations (invited_by_user_id);

create index if not exists idx_admin_invitations_approved_by_user_id
  on public.admin_invitations (approved_by_user_id);

create index if not exists idx_admin_invitations_accepted_by_user_id
  on public.admin_invitations (accepted_by_user_id);

create unique index if not exists idx_admin_invitations_open_email_unique
  on public.admin_invitations (lower(email))
  where invite_status in ('sent', 'accepted');

create index if not exists idx_profiles_admin_access_status
  on public.profiles (admin_access_status);

create index if not exists idx_profiles_admin_approved_by_user_id
  on public.profiles (admin_approved_by_user_id);

create index if not exists idx_profiles_admin_approved_at
  on public.profiles (admin_approved_at desc);

update public.profiles
set
  admin_access_status = case
    when admin_disabled_at is not null or coalesce(account_status::text, '') = 'disabled' then 'disabled'
    else 'active'
  end,
  admin_approved_at = coalesce(admin_approved_at, updated_at, created_at, timezone('utc', now()))
where role = 'admin'
  and admin_access_status is null;

comment on column public.profiles.admin_access_status is 'Owner-controlled admin access state. Pending approval admins must not receive live admin access until explicitly approved.';
comment on column public.profiles.admin_approved_by_user_id is 'Super admin who explicitly approved this admin account.';
comment on column public.profiles.admin_approved_at is 'Timestamp when this admin account was explicitly approved.';
comment on column public.profiles.admin_invitation_id is 'Invitation record that created this admin access path.';

comment on table public.admin_invitations is 'Owner-controlled admin invitation records. Admin access should only become active after acceptance and explicit owner approval.';
comment on column public.admin_invitations.email is 'Email address receiving the admin invitation link.';
comment on column public.admin_invitations.invited_admin_level is 'Requested RBAC level for the invited admin.';
comment on column public.admin_invitations.invited_by_user_id is 'Super admin who sent the invitation.';
comment on column public.admin_invitations.invite_token is 'Secure token used in the admin invitation link.';
comment on column public.admin_invitations.invite_status is 'Invitation lifecycle state: sent, accepted, approved, revoked, or expired.';
comment on column public.admin_invitations.owner_approval_required is 'Whether explicit owner/super-admin approval is required before live admin access.';
comment on column public.admin_invitations.approved_by_user_id is 'Super admin who approved the invitation after acceptance.';
comment on column public.admin_invitations.approved_at is 'Timestamp when the invitation was explicitly approved.';
comment on column public.admin_invitations.accepted_by_user_id is 'User who accepted the admin invitation link.';
comment on column public.admin_invitations.accepted_at is 'Timestamp when the invite recipient accepted the invitation.';
comment on column public.admin_invitations.revoked_by_user_id is 'Super admin who revoked the invitation.';
comment on column public.admin_invitations.revoked_at is 'Timestamp when the invitation was revoked.';
comment on column public.admin_invitations.expires_at is 'Optional expiration time for the invitation link.';
comment on column public.admin_invitations.note is 'Internal note describing the admin invite or approval context.';

commit;