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
    id varchar(50) primary key,
    category_id varchar(50) not null default '',
    name varchar(200) not null,
    description text,
    price numeric(10, 2) not null default 0,
    calorie_info varchar(100),
    is_spicy boolean not null default false,
    is_bestseller boolean not null default false,
    image_url text,
    has_options boolean not null default false,
    is_available boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.menu_items add column if not exists category_id varchar(50) not null default '';
alter table public.menu_items add column if not exists calorie_info varchar(100);
alter table public.menu_items add column if not exists is_spicy boolean not null default false;
alter table public.menu_items add column if not exists is_bestseller boolean not null default false;
alter table public.menu_items add column if not exists image_url text;
alter table public.menu_items add column if not exists has_options boolean not null default false;
alter table public.menu_items add column if not exists is_available boolean not null default true;
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
    id varchar(50) primary key,
    order_number varchar(20) unique not null,
    order_type varchar(20) not null default 'delivery',
    customer_name varchar(100) not null,
    customer_phone varchar(50) not null,
    customer_email varchar(120) not null,
    delivery_address text not null,
    delivery_postcode varchar(20) not null,
    delivery_notes text,
    items_json jsonb not null default '[]'::jsonb,
    subtotal numeric(10, 2) not null default 0,
    discount_amount numeric(10, 2) not null default 0,
    delivery_fee numeric(10, 2) not null default 0,
    total numeric(10, 2) not null default 0,
    voucher_code varchar(50),
    payment_method varchar(50) not null default 'card',
    payment_status varchar(50) not null default 'Pending',
    order_status varchar(50) not null default 'Placed',
    order_time varchar(100),
    cancellation_reason text,
    created_at timestamptz not null default now()
);

create table if not exists public.reviews (
    id varchar(50) primary key,
    customer_name varchar(100) not null default '',
    rating integer not null default 5 check (rating between 1 and 5),
    type varchar(30) not null default 'Review',
    category varchar(80) not null default 'General',
    comment text not null default '',
    order_number varchar(30),
    status varchar(30) not null default 'Published',
    response text,
    date timestamptz not null default now()
);

create table if not exists public.customers (
    id text primary key,
    name text not null,
    email text not null,
    phone text not null default '',
    address text not null default '',
    postcode text not null default '',
    password_hash text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz
);

create unique index if not exists ix_customers_email_lower on public.customers (lower(email));
create index if not exists ix_orders_created_at on public.orders (created_at desc);
create index if not exists ix_orders_order_status on public.orders (order_status);
create index if not exists ix_reviews_date on public.reviews (date desc);

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
order by table_name;
