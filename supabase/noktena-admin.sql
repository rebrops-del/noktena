-- NOKTENA admin backend for Supabase
-- Safe to run repeatedly.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_catalog_admin() from public;
grant execute on function public.is_catalog_admin() to anon, authenticated;

drop policy if exists "admin can read own admin record" on public.admin_users;
create policy "admin can read own admin record"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

create table if not exists public.catalog_overrides (
  product_key text primary key,
  kind text not null check (kind in ('furniture','mattress')),
  source_id text,
  payload jsonb not null default '{}'::jsonb,
  hidden boolean not null default false,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists catalog_overrides_kind_idx
  on public.catalog_overrides(kind);

create or replace function public.set_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists catalog_overrides_touch on public.catalog_overrides;
create trigger catalog_overrides_touch
before insert or update on public.catalog_overrides
for each row execute function public.set_catalog_updated_at();

alter table public.catalog_overrides enable row level security;

-- The storefront needs anonymous read access. The table stores only public catalog data.
drop policy if exists "public can read catalog overrides" on public.catalog_overrides;
create policy "public can read catalog overrides"
on public.catalog_overrides
for select
to anon, authenticated
using (true);

drop policy if exists "admins can insert catalog overrides" on public.catalog_overrides;
create policy "admins can insert catalog overrides"
on public.catalog_overrides
for insert
to authenticated
with check (public.is_catalog_admin());

drop policy if exists "admins can update catalog overrides" on public.catalog_overrides;
create policy "admins can update catalog overrides"
on public.catalog_overrides
for update
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

drop policy if exists "admins can delete catalog overrides" on public.catalog_overrides;
create policy "admins can delete catalog overrides"
on public.catalog_overrides
for delete
to authenticated
using (public.is_catalog_admin());

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can view product images" on storage.objects;
create policy "public can view product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "admins can upload product images" on storage.objects;
create policy "admins can upload product images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_catalog_admin());

drop policy if exists "admins can update product images" on storage.objects;
create policy "admins can update product images"
on storage.objects
for update
to authenticated
using (bucket_id = 'product-images' and public.is_catalog_admin())
with check (bucket_id = 'product-images' and public.is_catalog_admin());

drop policy if exists "admins can delete product images" on storage.objects;
create policy "admins can delete product images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-images' and public.is_catalog_admin());

-- After the first Auth user is created, grant that user admin access:
-- insert into public.admin_users (user_id, email)
-- select id, email from auth.users where email = 'YOUR_EMAIL@example.com'
-- on conflict (user_id) do nothing;
