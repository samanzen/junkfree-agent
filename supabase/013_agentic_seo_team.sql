-- ============================================================
-- FEATURE 01: Unified Agentic SEO Team + Autopilot Foundation
--
-- Additive / idempotent. Extends brands with execution modes,
-- persists Manager tasks/findings/QA/activity, and adds rollback
-- columns on publish_executions. Safe to re-run.
-- ============================================================

-- ── 1. Brand automation mode ────────────────────────────────────────────────
-- approval  = research/plan/generate/QA only; site changes need human approval
-- hybrid    = low-risk reversible actions may auto-execute (maps from today's
--             auto_publish_meta=true behaviour for fix_meta)
-- autopilot = full autonomous loop subject to policy + QA + limits
alter table brands add column if not exists execution_mode text;
alter table brands add column if not exists autopilot_enabled boolean not null default true;

-- Backfill from the legacy boolean. Existing brands that already auto-publish
-- become hybrid (closest semantic match). Everyone else defaults to approval
-- (safest). Explicitly leave execution_mode null-check so re-runs don't
-- overwrite an operator's later choice.
update brands
set execution_mode = case when auto_publish_meta then 'hybrid' else 'approval' end
where execution_mode is null;

alter table brands alter column execution_mode set default 'approval';

-- Constrain known values without failing on any unexpected historical text
-- if a future migration widens the set first.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'brands_execution_mode_check'
  ) then
    alter table brands
      add constraint brands_execution_mode_check
      check (execution_mode in ('approval', 'hybrid', 'autopilot'));
  end if;
end $$;

comment on column brands.execution_mode is
  'Feature 01 automation mode: approval | hybrid | autopilot. Defaults to approval; hybrid preserves prior auto_publish_meta=true.';
comment on column brands.autopilot_enabled is
  'Emergency kill switch. When false, Autopilot/Hybrid auto-execution is forced to REQUIRE_APPROVAL.';

-- ── 2. Agent tasks (Manager coordination; jobs remain the execution queue) ──
create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  job_id uuid,
  parent_task_id uuid references agent_tasks(id) on delete set null,

  capability text not null,
  objective text not null,
  status text not null default 'queued'
    check (status in ('queued','running','done','failed','blocked','waiting_approval','revised')),
  priority int not null default 50,
  risk_level text not null default 'medium'
    check (risk_level in ('low','medium','high','critical')),
  confidence numeric,
  depends_on uuid[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  result_summary text,
  error text,
  revision_count int not null default 0,
  max_revisions int not null default 1,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists agent_tasks_brand_run_idx
  on agent_tasks (brand_id, run_id, created_at desc);
create index if not exists agent_tasks_brand_status_idx
  on agent_tasks (brand_id, status, created_at desc);
create index if not exists agent_tasks_capability_idx
  on agent_tasks (brand_id, capability, created_at desc);

alter table agent_tasks enable row level security;
revoke all on table agent_tasks from anon, authenticated;
grant all privileges on table agent_tasks to service_role;

comment on table agent_tasks is
  'SEO Manager coordination ledger. The jobs table remains the claimable execution queue; this table tracks objectives, dependencies, risk/confidence, and outcomes for observability and handoffs.';

-- ── 3. Agent findings (machine-consumable specialist outputs) ───────────────
create table if not exists agent_findings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  task_id uuid references agent_tasks(id) on delete set null,
  capability text not null,
  finding_type text not null,
  title text not null,
  summary text,
  evidence jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  proposed_actions jsonb not null default '[]'::jsonb,
  confidence numeric,
  risk_level text not null default 'medium'
    check (risk_level in ('low','medium','high','critical')),
  status text not null default 'active'
    check (status in ('active','superseded','consumed','dismissed')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_findings_brand_cap_idx
  on agent_findings (brand_id, capability, created_at desc);
create index if not exists agent_findings_brand_type_idx
  on agent_findings (brand_id, finding_type, created_at desc);
create index if not exists agent_findings_active_idx
  on agent_findings (brand_id, status, created_at desc)
  where status = 'active';

alter table agent_findings enable row level security;
revoke all on table agent_findings from anon, authenticated;
grant all privileges on table agent_findings to service_role;

comment on table agent_findings is
  'Structured specialist outputs consumed by the SEO Manager and downstream agents. Brand-scoped; never shared across tenants.';

-- ── 4. QA results ───────────────────────────────────────────────────────────
create table if not exists agent_qa_results (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  task_id uuid references agent_tasks(id) on delete set null,
  draft_id uuid references drafts(id) on delete set null,
  outcome text not null check (outcome in ('PASS','REVISE','BLOCK')),
  score numeric,
  issues jsonb not null default '[]'::jsonb,
  feedback text,
  revision_attempt int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists agent_qa_brand_draft_idx
  on agent_qa_results (brand_id, draft_id, created_at desc);
create index if not exists agent_qa_brand_outcome_idx
  on agent_qa_results (brand_id, outcome, created_at desc);

alter table agent_qa_results enable row level security;
revoke all on table agent_qa_results from anon, authenticated;
grant all privileges on table agent_qa_results to service_role;

comment on table agent_qa_results is
  'Independent SEO QA / Critic outcomes that gate approval and autopilot publication.';

-- ── 5. Activity timeline (customer/admin observability) ─────────────────────
create table if not exists agent_activity (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  task_id uuid references agent_tasks(id) on delete set null,
  capability text,
  event_type text not null,
  title text not null,
  detail text,
  decision text,
  status text not null default 'info'
    check (status in ('info','success','warning','error','blocked','waiting')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_activity_brand_time_idx
  on agent_activity (brand_id, created_at desc);
create index if not exists agent_activity_run_idx
  on agent_activity (brand_id, run_id, created_at desc)
  where run_id is not null;

alter table agent_activity enable row level security;
revoke all on table agent_activity from anon, authenticated;
grant all privileges on table agent_activity to service_role;

comment on table agent_activity is
  'Concise autonomous-team activity feed. Stores decision summaries and outcomes — never raw chain-of-thought.';

-- ── 6. Publish execution rollback foundation ────────────────────────────────
alter table publish_executions add column if not exists run_id uuid;
alter table publish_executions add column if not exists agent_task_id uuid;
alter table publish_executions add column if not exists rollback_supported boolean not null default false;
alter table publish_executions add column if not exists rollback_status text;
alter table publish_executions add column if not exists rolled_back_at timestamptz;
alter table publish_executions add column if not exists rollback_error text;

create index if not exists publish_executions_rollback_idx
  on publish_executions (brand_id, rollback_status, executed_at desc)
  where rollback_supported = true;

comment on column publish_executions.rollback_supported is
  'True only when previous state was captured AND the adapter can restore it. Never claim rollback for unsupported actions.';
comment on column publish_executions.rollback_status is
  'null | available | rolled_back | failed | unsupported';
