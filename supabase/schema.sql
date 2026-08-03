-- RFC Watford Supabase bootstrap
-- Run this entire script in Supabase SQL Editor on the Primary Database.
-- It creates the public tables used by the ASP.NET Core API and seeds starter data.

create extension if not exists "pgcrypto";

create table if not exists public.menu_categories (
    id varchar(50) primary key,
    name varchar(100) not null,
    display_order integer not null default 0,
    icon_name varchar(50) not null default 'Utensils'
);

create table if not exists public.menu_items (
    id varchar(80) primary key,
    category_id varchar(80) not null default '',
    name varchar(180) not null,
    description varchar(1000) not null default '',
    price numeric(10, 2) not null default 0,
    calorie_info varchar(80) not null default '',
    is_spicy boolean not null default false,
    is_bestseller boolean not null default false,
    image_url varchar(1000) not null default '',
    has_options boolean not null default false,
    is_available boolean not null default true,
    stock_count integer not null default 999,
    created_at timestamptz not null default now()
);

alter table public.menu_items add column if not exists category_id varchar(80) not null default '';
alter table public.menu_items add column if not exists calorie_info varchar(80) not null default '';
alter table public.menu_items add column if not exists is_spicy boolean not null default false;
alter table public.menu_items add column if not exists is_bestseller boolean not null default false;
alter table public.menu_items add column if not exists image_url varchar(1000) not null default '';
alter table public.menu_items add column if not exists has_options boolean not null default false;
alter table public.menu_items add column if not exists is_available boolean not null default true;
alter table public.menu_items add column if not exists stock_count integer not null default 999;
alter table public.menu_items add column if not exists created_at timestamptz not null default now();

create table if not exists public.vouchers (
    code varchar(50) primary key,
    discount_percent numeric(5, 2) not null,
    min_spend numeric(10, 2) not null default 0,
    description varchar(255),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.orders (
    id varchar(80) primary key,
    order_number varchar(20) unique not null,
    order_type varchar(20) not null default 'delivery',
    customer_name varchar(100) not null,
    customer_phone varchar(50) not null,
    customer_email varchar(120) not null,
    customer_id varchar(80),
    order_access_token_hash varchar(128),
    order_access_token_expires_at timestamptz,
    delivery_address varchar(500) not null default '',
    delivery_postcode varchar(20) not null default '',
    delivery_notes varchar(500) not null default '',
    items_json jsonb not null default '[]'::jsonb,
    subtotal numeric(10, 2) not null default 0,
    discount_amount numeric(10, 2) not null default 0,
    delivery_fee numeric(10, 2) not null default 0,
    total numeric(10, 2) not null default 0,
    voucher_code varchar(50),
    payment_method varchar(50) not null default 'card',
    payment_status varchar(50) not null default 'Pending',
    order_status varchar(50) not null default 'Placed',
    order_time varchar(100) not null default '',
    cancellation_reason varchar(500),
    stripe_payment_intent_id varchar(200),
    checkout_id varchar(80),
    delivery_lat numeric(9, 6),
    delivery_lng numeric(9, 6),
    eta_minutes integer,
    driver_id varchar(80),
    created_at timestamptz not null default now()
);

alter table public.orders add column if not exists stripe_payment_intent_id varchar(200);
alter table public.orders add column if not exists delivery_lat numeric(9, 6);
alter table public.orders add column if not exists delivery_lng numeric(9, 6);
alter table public.orders add column if not exists eta_minutes integer;
alter table public.orders add column if not exists driver_id varchar(80);
alter table public.orders add column if not exists customer_id varchar(80);
alter table public.orders add column if not exists order_access_token_hash varchar(128);
alter table public.orders add column if not exists order_access_token_expires_at timestamptz;
alter table public.orders add column if not exists checkout_id varchar(80);

create table if not exists public.reviews (
    id varchar(80) primary key,
    customer_name varchar(100) not null default '',
    rating integer not null default 5 check (rating between 1 and 5),
    type varchar(30) not null default 'Review',
    category varchar(80) not null default 'General',
    comment varchar(2000) not null default '',
    order_number varchar(30),
    status varchar(30) not null default 'Published',
    response varchar(1000),
    date timestamptz not null default now()
);

create table if not exists public.customers (
    id varchar(80) primary key,
    name varchar(100) not null,
    email varchar(120) not null,
    phone varchar(30) not null default '',
    address varchar(400) not null default '',
    postcode varchar(20) not null default '',
    password_hash varchar(300) not null,
    security_stamp varchar(64) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz
);

create table if not exists public.staff_users (
    id varchar(80) primary key,
    name varchar(100) not null,
    email varchar(120) not null,
    password_hash varchar(300) not null,
    security_stamp varchar(64) not null,
    role varchar(30) not null default 'staff',
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.login_attempts (
    id varchar(80) primary key,
    email varchar(120) not null,
    attempt_count integer not null default 0,
    last_attempt_at timestamptz not null default now(),
    locked_until timestamptz
);

create table if not exists public.audit_logs (
    id varchar(80) primary key,
    user_id varchar(80),
    action varchar(120) not null,
    entity_type varchar(80) not null,
    entity_id varchar(120),
    old_value jsonb,
    new_value jsonb,
    timestamp timestamptz not null default now(),
    ip_address varchar(80)
);

create table if not exists public.store_settings (
    key varchar(120) primary key,
    value jsonb not null default '{}'::jsonb
);

create table if not exists public.payment_webhook_events (
    id varchar(120) primary key,
    type varchar(120) not null,
    payment_intent_id varchar(200),
    received_at timestamptz not null,
    processed_at timestamptz
);

create table if not exists public.voucher_redemptions (
    id varchar(80) primary key,
    code varchar(50) not null,
    customer_id varchar(80) not null,
    order_id varchar(80) not null,
    redeemed_at timestamptz not null
);

alter table public.customers add column if not exists security_stamp varchar(64);
update public.customers
set security_stamp = md5(random()::text || clock_timestamp()::text || id)
where security_stamp is null or security_stamp = '';
alter table public.customers alter column security_stamp set not null;

alter table public.staff_users add column if not exists security_stamp varchar(64);
update public.staff_users
set security_stamp = md5(random()::text || clock_timestamp()::text || id)
where security_stamp is null or security_stamp = '';
alter table public.staff_users alter column security_stamp set not null;

-- Legacy bootstrap versions used shorter IDs and unbounded text columns. Fail
-- before narrowing if any stored value violates the EF model; never truncate.
do $$
begin
    if exists (select 1 from public.menu_items where char_length(name) > 180) then
        raise exception 'menu_items.name exceeds the EF maximum length of 180';
    end if;
    if exists (select 1 from public.menu_items where char_length(description) > 1000) then
        raise exception 'menu_items.description exceeds the EF maximum length of 1000';
    end if;
    if exists (select 1 from public.menu_items where char_length(calorie_info) > 80) then
        raise exception 'menu_items.calorie_info exceeds the EF maximum length of 80';
    end if;
    if exists (select 1 from public.menu_items where char_length(image_url) > 1000) then
        raise exception 'menu_items.image_url exceeds the EF maximum length of 1000';
    end if;
    if exists (select 1 from public.orders where char_length(delivery_address) > 500) then
        raise exception 'orders.delivery_address exceeds the EF maximum length of 500';
    end if;
    if exists (select 1 from public.orders where char_length(delivery_notes) > 500) then
        raise exception 'orders.delivery_notes exceeds the EF maximum length of 500';
    end if;
    if exists (select 1 from public.orders where char_length(cancellation_reason) > 500) then
        raise exception 'orders.cancellation_reason exceeds the EF maximum length of 500';
    end if;
    if exists (select 1 from public.reviews where char_length(comment) > 2000) then
        raise exception 'reviews.comment exceeds the EF maximum length of 2000';
    end if;
    if exists (select 1 from public.reviews where char_length(response) > 1000) then
        raise exception 'reviews.response exceeds the EF maximum length of 1000';
    end if;
    if exists (select 1 from public.customers where char_length(id) > 80) then
        raise exception 'customers.id exceeds the EF maximum length of 80';
    end if;
    if exists (select 1 from public.customers where char_length(name) > 100) then
        raise exception 'customers.name exceeds the EF maximum length of 100';
    end if;
    if exists (select 1 from public.customers where char_length(email) > 120) then
        raise exception 'customers.email exceeds the EF maximum length of 120';
    end if;
    if exists (select 1 from public.customers where char_length(phone) > 30) then
        raise exception 'customers.phone exceeds the EF maximum length of 30';
    end if;
    if exists (select 1 from public.customers where char_length(address) > 400) then
        raise exception 'customers.address exceeds the EF maximum length of 400';
    end if;
    if exists (select 1 from public.customers where char_length(postcode) > 20) then
        raise exception 'customers.postcode exceeds the EF maximum length of 20';
    end if;
    if exists (select 1 from public.customers where char_length(password_hash) > 300) then
        raise exception 'customers.password_hash exceeds the EF maximum length of 300';
    end if;
end
$$;

update public.menu_items
set description = coalesce(description, ''),
    calorie_info = coalesce(calorie_info, ''),
    image_url = coalesce(image_url, '');
alter table public.menu_items alter column id type varchar(80);
alter table public.menu_items alter column category_id type varchar(80);
alter table public.menu_items alter column name type varchar(180);
alter table public.menu_items alter column description type varchar(1000);
alter table public.menu_items alter column description set default '';
alter table public.menu_items alter column description set not null;
alter table public.menu_items alter column calorie_info type varchar(80);
alter table public.menu_items alter column calorie_info set default '';
alter table public.menu_items alter column calorie_info set not null;
alter table public.menu_items alter column image_url type varchar(1000);
alter table public.menu_items alter column image_url set default '';
alter table public.menu_items alter column image_url set not null;

update public.orders
set delivery_notes = coalesce(delivery_notes, ''),
    order_time = coalesce(order_time, '');
alter table public.orders alter column id type varchar(80);
alter table public.orders alter column delivery_address type varchar(500);
alter table public.orders alter column delivery_address set default '';
alter table public.orders alter column delivery_notes type varchar(500);
alter table public.orders alter column delivery_notes set default '';
alter table public.orders alter column delivery_notes set not null;
alter table public.orders alter column delivery_postcode set default '';
alter table public.orders alter column order_time set default '';
alter table public.orders alter column order_time set not null;
alter table public.orders alter column cancellation_reason type varchar(500);

alter table public.reviews alter column id type varchar(80);
alter table public.reviews alter column comment type varchar(2000);
alter table public.reviews alter column response type varchar(1000);

alter table public.customers alter column id type varchar(80);
alter table public.customers alter column name type varchar(100);
alter table public.customers alter column email type varchar(120);
alter table public.customers alter column phone type varchar(30);
alter table public.customers alter column address type varchar(400);
alter table public.customers alter column postcode type varchar(20);
alter table public.customers alter column password_hash type varchar(300);

create unique index if not exists ix_customers_email_lower on public.customers (lower(email));
create unique index if not exists ix_customers_email on public.customers (email);
create unique index if not exists ix_staff_users_email_lower on public.staff_users (lower(email));
create unique index if not exists ix_staff_users_email on public.staff_users (email);
create unique index if not exists ix_login_attempts_email_lower on public.login_attempts (lower(email));
create unique index if not exists ix_login_attempts_email on public.login_attempts (email);
create unique index if not exists ix_orders_order_number on public.orders (order_number);
create index if not exists ix_orders_created_at on public.orders (created_at);
create index if not exists ix_orders_order_status on public.orders (order_status);
drop index if exists public.ix_orders_stripe_payment_intent_id;
create unique index ix_orders_stripe_payment_intent_id
    on public.orders (stripe_payment_intent_id)
    where stripe_payment_intent_id is not null;
create unique index if not exists ix_orders_checkout_id
    on public.orders (checkout_id)
    where checkout_id is not null;
create index if not exists ix_orders_customer_id on public.orders (customer_id);
create index if not exists ix_orders_order_access_token_hash on public.orders (order_access_token_hash);
create index if not exists ix_orders_order_status_created_at on public.orders (order_status, created_at);
create index if not exists ix_orders_customer_email on public.orders (customer_email);
create index if not exists ix_reviews_date on public.reviews (date desc);
create index if not exists ix_reviews_status_date on public.reviews (status, date);
create index if not exists ix_audit_logs_timestamp on public.audit_logs (timestamp);
create index if not exists ix_payment_webhook_events_received_at
    on public.payment_webhook_events (received_at);
create unique index if not exists ix_voucher_redemptions_code_customer_id
    on public.voucher_redemptions (code, customer_id);

-- The ASP.NET Core API uses a direct PostgreSQL connection. These tables must
-- not also be exposed through Supabase's PostgREST Data API. No RLS policies are
-- granted to Supabase API roles, so Data API requests fail closed, including
-- requests made with the service-role key. The only policy path is the dedicated
-- direct-login role `rfc_backend`; provision and grant it as documented in
-- supabase/README.md. It must not be a superuser and must not have BYPASSRLS.
alter table public.menu_categories enable row level security;
alter table public.menu_categories force row level security;
alter table public.menu_items enable row level security;
alter table public.menu_items force row level security;
alter table public.vouchers enable row level security;
alter table public.vouchers force row level security;
alter table public.orders enable row level security;
alter table public.orders force row level security;
alter table public.reviews enable row level security;
alter table public.reviews force row level security;
alter table public.customers enable row level security;
alter table public.customers force row level security;
alter table public.staff_users enable row level security;
alter table public.staff_users force row level security;
alter table public.login_attempts enable row level security;
alter table public.login_attempts force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
alter table public.store_settings enable row level security;
alter table public.store_settings force row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.payment_webhook_events force row level security;
alter table public.voucher_redemptions enable row level security;
alter table public.voucher_redemptions force row level security;

drop policy if exists rfc_backend_direct_access on public.menu_categories;
create policy rfc_backend_direct_access on public.menu_categories for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.menu_items;
create policy rfc_backend_direct_access on public.menu_items for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.vouchers;
create policy rfc_backend_direct_access on public.vouchers for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.orders;
create policy rfc_backend_direct_access on public.orders for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.reviews;
create policy rfc_backend_direct_access on public.reviews for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.customers;
create policy rfc_backend_direct_access on public.customers for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.staff_users;
create policy rfc_backend_direct_access on public.staff_users for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.login_attempts;
create policy rfc_backend_direct_access on public.login_attempts for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.audit_logs;
create policy rfc_backend_direct_access on public.audit_logs for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.store_settings;
create policy rfc_backend_direct_access on public.store_settings for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.payment_webhook_events;
create policy rfc_backend_direct_access on public.payment_webhook_events for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');
drop policy if exists rfc_backend_direct_access on public.voucher_redemptions;
create policy rfc_backend_direct_access on public.voucher_redemptions for all to public
    using (current_user = 'rfc_backend') with check (current_user = 'rfc_backend');

revoke all privileges on table
    public.menu_categories,
    public.menu_items,
    public.vouchers,
    public.orders,
    public.reviews,
    public.customers,
    public.staff_users,
    public.login_attempts,
    public.audit_logs,
    public.store_settings,
    public.payment_webhook_events,
    public.voucher_redemptions
from anon, authenticated, service_role, public;

revoke all privileges on all sequences in schema public from anon, authenticated, service_role, public;
revoke all privileges on all functions in schema public from anon, authenticated, service_role, public;
revoke usage on schema public from anon, authenticated, service_role;
revoke create on schema public from public;

alter default privileges for role postgres in schema public
    revoke all privileges on tables from anon, authenticated, service_role, public;
alter default privileges for role postgres in schema public
    revoke all privileges on sequences from anon, authenticated, service_role, public;
alter default privileges for role postgres in schema public
    revoke all privileges on functions from anon, authenticated, service_role, public;

insert into public.menu_categories (id, name, display_order, icon_name) values
('box-meals', 'Box Meals', 10, 'Package'),
('burgers-meals', 'Burgers and Meals', 20, 'Beef'),
('family-buckets', 'Family Buckets', 30, 'ShoppingBag'),
('fried-chicken', 'Fried Chicken and Wings', 40, 'Drumstick'),
('wraps', 'Wraps and Ribs', 50, 'UtensilsCrossed'),
('sides', 'Sides and Dips', 60, 'Popcorn'),
('desserts-drinks', 'Desserts and Drinks', 70, 'IceCream'),
('kids', 'Kids Meals', 80, 'Smile')
on conflict (id) do update set
    name = excluded.name,
    display_order = excluded.display_order,
    icon_name = excluded.icon_name;

insert into public.menu_items
(id, category_id, name, description, price, calorie_info, is_spicy, is_bestseller, image_url, has_options, is_available)
values
('bm-1', 'box-meals', 'Boneless Banquet Meal', '3 Chicken Strips, Small Popcorn Chicken, 1 Side, Regular Fries and Drink.', 8.99, '980 kcal', false, true, 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80', true, true),
('bm-2', 'box-meals', 'Club Max Box Meal', 'Club Max Burger with 3 Spicy Wings, 1 Side, Regular Fries and Choice of Drink.', 8.99, '1120 kcal', true, true, 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=600&auto=format&fit=crop&q=80', true, true),
('bm-3', 'box-meals', 'Devils Box Meal', 'A Fillet Maxi Burger with 2 Spicy Wings, 1 Regular Beans, 1 Regular Fries and Choice of Drink.', 9.89, '1250 kcal', true, false, 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80', true, true),
('bg-1', 'burgers-meals', 'Club Max Burger', '2 Crispy Chicken Strips, cheese, hash brown, lettuce and mayo in a toasted sesame bun.', 6.99, '780 kcal', true, true, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80', false, true),
('bg-2', 'burgers-meals', 'Fillet Burger Meal', 'Chicken breast fillet with lettuce and mayo, served with regular fries and drink.', 5.79, '750 kcal', false, true, 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80', true, true),
('bg-3', 'burgers-meals', 'Double Ringer Meal', 'Chicken Fillet Burger with onion rings, cheese, regular fries and drink or side.', 6.99, '890 kcal', false, false, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80', true, true),
('bk-1', 'family-buckets', 'Family Feast Meal', '8 or 12 pieces chicken, 4 regular fries, 2 large sides and 1.5L drink.', 21.99, '2800 kcal', false, true, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80', true, true),
('bk-2', 'family-buckets', 'Variety Bucket', '6 or 10 pieces chicken, chicken strips or spicy wings and 4 regular fries.', 21.99, '2600 kcal', true, true, 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80', true, true),
('bk-3', 'family-buckets', 'Wings Bucket and Burgers', '20 hot spicy chicken wings, 4 mini chicken burgers and 4 regular fries.', 25.99, '3100 kcal', true, true, 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=600&auto=format&fit=crop&q=80', false, true),
('fc-1', 'fried-chicken', 'Spicy Wings Meal (6 Wings)', '6 crispy spicy wings, fries and drink.', 7.49, '850 kcal', true, true, 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&auto=format&fit=crop&q=80', true, true),
('fc-2', 'fried-chicken', 'Chicken Meal (2 or 3 Pieces)', '2 or 3 pieces of golden fried chicken, fries and drink.', 7.49, '820 kcal', false, true, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80', true, true),
('sd-1', 'sides', 'Regular Fries', 'Golden crispy potato fries.', 2.79, '320 kcal', false, true, 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80', false, true),
('sd-2', 'sides', 'Chili Cheese Bites (5 Pcs)', 'Melted jalapeno cheese bites coated in golden breadcrumbs.', 4.49, '410 kcal', true, true, 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80', false, true),
('dd-1', 'desserts-drinks', 'Ben and Jerrys Ice Cream (465ml)', 'Cookie Dough, Chocolate Fudge Brownie, or Caramel Chew Chew.', 6.49, '1100 kcal', false, true, 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=600&auto=format&fit=crop&q=80', false, true),
('kd-1', 'kids', 'Kids Nuggets (4 Pcs) Meal', '4 golden chicken nuggets, regular fries, fruit juice or small water.', 4.99, '420 kcal', false, false, 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80', false, true)
on conflict (id) do update set
    category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    calorie_info = excluded.calorie_info,
    is_spicy = excluded.is_spicy,
    is_bestseller = excluded.is_bestseller,
    image_url = excluded.image_url,
    has_options = excluded.has_options,
    is_available = excluded.is_available;

insert into public.vouchers (code, discount_percent, min_spend, description, is_active) values
('FIRST10', 10.00, 0.00, '10 percent off your first order', true),
('OVER25', 10.00, 25.00, '10 percent off orders over GBP 25', true),
('RFC10', 10.00, 0.00, 'Direct order discount', true)
on conflict (code) do update set
    discount_percent = excluded.discount_percent,
    min_spend = excluded.min_spend,
    description = excluded.description,
    is_active = excluded.is_active;

insert into public.store_settings (key, value) values
('OpeningHours', '{
  "Monday": {"open": "11:00", "close": "23:00"},
  "Tuesday": {"open": "11:00", "close": "23:00"},
  "Wednesday": {"open": "11:00", "close": "23:00"},
  "Thursday": {"open": "11:00", "close": "23:00"},
  "Friday": {"open": "11:00", "close": "23:30"},
  "Saturday": {"open": "11:00", "close": "23:30"},
  "Sunday": {"open": "12:00", "close": "22:30"}
}'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into public.reviews (id, customer_name, rating, type, category, comment, order_number, status, response, date) values
('rev-1', 'Sarah M.', 5, 'Review', 'Food Quality', 'The bucket was crispy and hot. Delivered in 25 minutes.', 'RFC-849201', 'Published', 'Thank you Sarah. Glad you loved it.', now()),
('rev-2', 'David K.', 5, 'Review', 'Delivery Speed', 'Always fast delivery to Berry Avenue. Voucher worked perfectly.', null, 'Published', null, now()),
('rev-3', 'James P.', 2, 'Complaint', 'Missing Item', 'Ordered 2 large fries but only received 1.', 'RFC-849102', 'Resolved', 'Apologies James. We issued a store credit voucher.', now())
on conflict (id) do update set
    customer_name = excluded.customer_name,
    rating = excluded.rating,
    type = excluded.type,
    category = excluded.category,
    comment = excluded.comment,
    order_number = excluded.order_number,
    status = excluded.status,
    response = excluded.response,
    date = excluded.date;

select 'menu_categories' as table_name, count(*) as row_count from public.menu_categories
union all select 'menu_items', count(*) from public.menu_items
union all select 'vouchers', count(*) from public.vouchers
union all select 'orders', count(*) from public.orders
union all select 'reviews', count(*) from public.reviews
union all select 'customers', count(*) from public.customers
union all select 'staff_users', count(*) from public.staff_users
union all select 'login_attempts', count(*) from public.login_attempts
union all select 'audit_logs', count(*) from public.audit_logs
union all select 'store_settings', count(*) from public.store_settings
union all select 'payment_webhook_events', count(*) from public.payment_webhook_events
union all select 'voucher_redemptions', count(*) from public.voucher_redemptions
order by table_name;
