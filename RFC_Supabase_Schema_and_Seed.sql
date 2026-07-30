-- ============================================================
-- RFC WATFORD — SUPABASE POSTGRESQL DATABASE SCHEMA & SEED DATA
-- Project Ref: eakakbgpkimrlrjaeisa
-- ============================================================

-- 1. Create Menu Items Table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id VARCHAR(50) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    calorie_info VARCHAR(50),
    is_spicy BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    has_options BOOLEAN DEFAULT FALSE
);

-- 2. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(50) PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'delivery',
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(100) NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_postcode VARCHAR(20) NOT NULL,
    delivery_notes TEXT,
    items_json JSONB NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    delivery_fee NUMERIC(10, 2) DEFAULT 0.00,
    total NUMERIC(10, 2) NOT NULL,
    voucher_code VARCHAR(50),
    payment_method VARCHAR(50) DEFAULT 'card',
    payment_status VARCHAR(50) DEFAULT 'Paid',
    order_status VARCHAR(50) DEFAULT 'Placed',
    order_time VARCHAR(100),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Reviews & Complaints Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    rating INTEGER DEFAULT 5,
    type VARCHAR(30) DEFAULT 'Review', -- 'Review' or 'Complaint'
    category VARCHAR(50) DEFAULT 'General',
    comment TEXT NOT NULL,
    order_number VARCHAR(20),
    status VARCHAR(30) DEFAULT 'Published', -- 'Published', 'Pending', 'Resolved'
    response TEXT,
    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SEED INITIAL MENU ITEMS
-- ============================================================
INSERT INTO public.menu_items (id, category_id, name, description, price, calorie_info, is_spicy, is_bestseller, image_url, has_options)
VALUES
('bm-1', 'box-meals', 'Boneless Banquet Meal', '3 Chicken Strips, Small Popcorn Chicken, 1 Side, Regular Fries & Drink.', 8.99, '980 kcal', FALSE, TRUE, 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80', TRUE),
('bm-2', 'box-meals', 'Club Max Box Meal', 'Club Max Burger with 3 Spicy Wings, 1 Side, Regular Fries & Choice of Drink.', 8.99, '1120 kcal', TRUE, TRUE, 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=600&auto=format&fit=crop&q=80', TRUE),
('bg-1', 'burgers-meals', 'Club Max Burger', '2 Crispy 100% Chicken Strips coated in spicy marinade, cheese, hash brown, lettuce & mayo.', 6.99, '780 kcal', TRUE, TRUE, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80', FALSE),
('bk-1', 'family-buckets', 'Family Feast Meal', '8 or 12 Chicken, 4 Regular Fries, 2 Large Sides & 1.5L Drink.', 21.99, '2800 kcal', FALSE, TRUE, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80', TRUE),
('fc-1', 'fried-chicken', 'Spicy Wings Meal (6 Wings)', '6 Crispy Spicy Wings, Fries & Drink.', 7.49, '850 kcal', TRUE, TRUE, 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&auto=format&fit=crop&q=80', TRUE),
('sd-1', 'sides', 'Regular Fries', 'Golden crispy potato french fries.', 2.79, '320 kcal', FALSE, TRUE, 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED SAMPLE ORDERS
-- ============================================================
INSERT INTO public.orders (id, order_number, order_type, customer_name, customer_phone, customer_email, delivery_address, delivery_postcode, items_json, subtotal, discount_amount, delivery_fee, total, voucher_code, payment_method, payment_status, order_status, order_time, created_at)
VALUES
('ord-1001', 'RFC-849201', 'delivery', 'Vishnu Karun', '+44 7123 456789', 'vishnu@example.com', '37 Berry Avenue, Watford', 'WD24 6RU', '[{"Item":{"Id":"bm-1","Name":"Boneless Banquet Meal","Price":8.99},"Quantity":2,"UnitPrice":8.99}]', 17.98, 1.80, 0.00, 16.18, 'FIRST10', 'card', 'Paid', 'Completed', '29 Jul 2026, 18:30:00', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED REVIEWS & COMPLAINTS
-- ============================================================
INSERT INTO public.reviews (id, customer_name, rating, type, category, comment, order_number, status, response, date)
VALUES
('rev-1', 'Sarah M.', 5, 'Review', 'Food Quality', 'The 10-piece bucket was super crispy and piping hot! Delivered in 25 mins. Best chicken in Watford!', 'RFC-849201', 'Published', 'Thank you Sarah! Glad you loved the extra crispy recipe! 🍗', CURRENT_TIMESTAMP),
('rev-2', 'James P.', 2, 'Complaint', 'Missing Item', 'Ordered 2 Large Fries with my Box Meal but only received 1. Please check kitchen packaging.', 'RFC-849102', 'Resolved', 'Apologies James! We have issued a £5 credit voucher to your account.', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
