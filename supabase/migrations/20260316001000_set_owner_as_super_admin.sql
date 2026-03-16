begin;

do $$
declare
  v_owner_user_id uuid;
begin
  select id
  into v_owner_user_id
  from auth.users
  where lower(email) = lower('djimeanofficial@gmail.com')
  limit 1;

  if v_owner_user_id is null then
    raise exception 'Owner account not found in auth.users for the provided email.';
  end if;

  update public.profiles
  set
    role = 'admin',
    account_status = 'active',
    admin_level = 'super_admin',
    admin_access_status = 'active',
    admin_approved_by_user_id = v_owner_user_id,
    admin_approved_at = timezone('utc', now()),
    admin_role_changed_by_user_id = v_owner_user_id,
    admin_role_changed_at = timezone('utc', now()),
    admin_access_note = 'Owner elevated to super_admin during RBAC rollout.'
  where user_id = v_owner_user_id;
end
$$;

commit;