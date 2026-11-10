-- Nusantara Export Hub MVP database foundation
-- Run in Supabase SQL Editor after creating a project.
create extension if not exists pgcrypto;
create table if not exists public.producers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid references auth.users(id) on delete set null,
 business_name text not null, contact_person text, email text, phone_whatsapp text,
 regency_city text not null, address text, description text,
 verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 producer_id uuid not null references public.producers(id) on delete cascade,
 name text not null, category text not null, description text, origin_regency_city text, hs_code text,
 moq text, monthly_capacity text, indicative_price text, currency char(3) not null default 'USD',
 specifications jsonb not null default '{}'::jsonb, certifications text[] not null default '{}',
 image_urls text[] not null default '{}',
 publication_status text not null default 'draft' check (publication_status in ('draft','pending','published','archived')),
 created_at timestamptz not null default now()
);
create table if not exists public.buyer_rfqs (
 id uuid primary key default gen_random_uuid(), buyer_company text not null, contact_name text,
 email text not null, destination_country text not null, product_required text not null,
 quantity text not null, target_timeline text, specifications text,
 status text not null default 'new' check (status in ('new','reviewing','matched','introduced','closed','rejected')),
 created_at timestamptz not null default now()
);
create table if not exists public.rfq_matches (
 id uuid primary key default gen_random_uuid(), rfq_id uuid not null references public.buyer_rfqs(id) on delete cascade,
 producer_id uuid not null references public.producers(id) on delete cascade, match_notes text,
 status text not null default 'suggested' check (status in ('suggested','contacted','accepted','declined')),
 created_at timestamptz not null default now(), unique (rfq_id, producer_id)
);
alter table public.producers enable row level security;
alter table public.products enable row level security;
alter table public.buyer_rfqs enable row level security;
alter table public.rfq_matches enable row level security;
create policy "Public view verified producers" on public.producers for select using (verification_status='verified');
create policy "Public view published products" on public.products for select using (
 publication_status='published' and exists (select 1 from public.producers p where p.id=producer_id and p.verification_status='verified')
);
-- Keep RFQs and matching records private. Add authenticated/admin policies or a
-- rate-limited Supabase Edge Function before accepting live submissions.
-- Never expose the service_role key in browser JavaScript.
