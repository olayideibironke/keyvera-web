alter table public.agents
add column if not exists kyc_id_image_path text,
add column if not exists kyc_id_image_uploaded_at timestamptz,
add column if not exists kyc_submitted_at timestamptz;

insert into storage.buckets (id, name, public)
select 'agent-kyc', 'agent-kyc', false
where not exists (
  select 1
  from storage.buckets
  where id = 'agent-kyc'
);

drop policy if exists "agent_kyc_select_owner_or_admin" on storage.objects;
create policy "agent_kyc_select_owner_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'agent-kyc'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'
    )
  )
);

drop policy if exists "agent_kyc_insert_own" on storage.objects;
create policy "agent_kyc_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agent-kyc'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) = any (array['jpg', 'jpeg', 'png', 'webp'])
);

drop policy if exists "agent_kyc_update_own" on storage.objects;
create policy "agent_kyc_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'agent-kyc'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'agent-kyc'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) = any (array['jpg', 'jpeg', 'png', 'webp'])
);

drop policy if exists "agent_kyc_delete_owner_or_admin" on storage.objects;
create policy "agent_kyc_delete_owner_or_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'agent-kyc'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'
    )
  )
);