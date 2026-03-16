begin;

alter table public.agents
  add column if not exists kyc_reviewed_by_user_id uuid,
  add column if not exists kyc_reviewed_at timestamptz,
  add column if not exists kyc_review_note text,
  add column if not exists kyc_rejection_category text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agents_kyc_rejection_category_check'
      and conrelid = 'public.agents'::regclass
  ) then
    alter table public.agents
      add constraint agents_kyc_rejection_category_check
      check (
        kyc_rejection_category is null
        or kyc_rejection_category in (
          'missing_document',
          'unreadable_document',
          'expired_document',
          'identity_mismatch',
          'suspicious_document',
          'fraud_risk',
          'other'
        )
      );
  end if;
end
$$;

create index if not exists idx_agents_kyc_reviewed_at
  on public.agents (kyc_reviewed_at desc);

create index if not exists idx_agents_kyc_reviewed_by_user_id
  on public.agents (kyc_reviewed_by_user_id);

comment on column public.agents.kyc_reviewed_by_user_id is 'Admin user ID that made the latest KYC decision.';
comment on column public.agents.kyc_reviewed_at is 'Timestamp of the latest KYC decision.';
comment on column public.agents.kyc_review_note is 'Structured admin note explaining the latest KYC decision.';
comment on column public.agents.kyc_rejection_category is 'Structured rejection reason category for rejected KYC decisions.';

commit;