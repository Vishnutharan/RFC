-- =========================================================
-- RFC Watford Online Food Ordering & Booking Database Schema
-- Supabase PostgreSQL Setup DDL Script
-- =========================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_order INT DEFAULT 0,
    icon_name VARCHAR(50) DEFAULT 'Utensils'
);

-- 2. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
    id VARCHAR(50) PRIMARY KEY,
    category_id VARCHAR(50) REFERENCES public.menu_categories(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    calorie_info VARCHAR(100),
    is_spicy BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. VOUCHERS TABLE
CREATE TABLE IF NOT EXISTS public.vouchers (
    code VARCHAR(50) PRIMARY KEY,
    discount_percent DECIMAL(5, 2) NOT NULL,
    min_spend DECIMAL(10, 2) DEFAULT 0.00,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('delivery', 'collection')),
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    customer_email VARCHAR(100) NOT NULL,
    delivery_address TEXT,
    delivery_postcode VARCHAR(20),
    delivery_notes TEXT,
    scheduled_time VARCHAR(50) DEFAULT 'ASAP',
    items JSONB NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
    tip_amount DECIMAL(10, 2) DEFAULT 0.00,
    total DECIMAL(10, 2) NOT NULL,
    voucher_code VARCHAR(50),
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'paid',
    order_status VARCHAR(30) DEFAULT 'Placed' CHECK (order_status IN ('Placed', 'Preparing', 'Out for Delivery', 'Ready for Collection', 'Completed', 'Cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEED VOUCHERS
INSERT INTO public.vouchers (code, discount_percent, min_spend, description)
VALUES 
    ('FIRST10', 10.00, 0.00, 'Get 10% off your FIRST ORDER!'),
    ('OVER25', 10.00, 25.00, 'Get 10% off on any order over £25'),
    ('RFC10', 10.00, 0.00, 'Special 10% off voucher code')
ON CONFLICT (code) DO UPDATE SET discount_percent = EXCLUDED.discount_percent;

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on categories" ON public.menu_categories FOR SELECT USING (true);
CREATE POLICY "Allow public read on menu_items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Allow public read on vouchers" ON public.vouchers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select on orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow admin all access on orders" ON public.orders FOR ALL USING (true);
