-- ==============================================================================
-- MINIMART POS - SUPABASE POSTGRESQL DATABASE SCHEMA & SEED DATA
-- Run this script in your Supabase SQL Editor:
-- https://app.supabase.com/project/_/sql
-- ==============================================================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. PRODUCTS TABLE
create table if not exists products (
    id text primary key,
    barcode text unique not null,
    name text not null,
    category text not null,
    price numeric(10, 2) not null check (price >= 0),
    cost_price numeric(10, 2) not null check (cost_price >= 0),
    stock integer not null check (stock >= 0),
    reorder_level integer not null default 5,
    unit text not null default 'pcs',
    brand text,
    image text,
    images text[] default '{}',
    color text,
    icon_name text,
    is_taxable boolean not null default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Migrations for existing deployments
alter table products add column if not exists brand text;
alter table products add column if not exists image text;
alter table products add column if not exists images text[] default '{}';

create index if not exists idx_products_barcode on products (barcode);
create index if not exists idx_products_category on products (category);

-- 3. ORDERS TABLE
create table if not exists orders (
    id text primary key,
    receipt_number text unique not null,
    timestamp timestamptz not null default now(),
    subtotal numeric(10, 2) not null,
    discount_amount numeric(10, 2) not null default 0.00,
    tax_amount numeric(10, 2) not null default 0.00,
    total numeric(10, 2) not null,
    payment_method text not null check (payment_method in ('CASH', 'CARD', 'QR', 'SPLIT')),
    amount_tendered numeric(10, 2) not null,
    change_given numeric(10, 2) not null default 0.00,
    cashier_name text not null,
    status text not null default 'COMPLETED' check (status in ('COMPLETED', 'REFUNDED')),
    refund_reason text,
    notes text,
    created_at timestamptz default now()
);

create index if not exists idx_orders_receipt on orders (receipt_number);
create index if not exists idx_orders_timestamp on orders (timestamp desc);

-- 4. ORDER ITEMS TABLE (Relational order breakdown)
create table if not exists order_items (
    id uuid primary key default uuid_generate_v4(),
    order_id text not null references orders(id) on delete cascade,
    product_id text references products(id) on delete set null,
    product_name text not null,
    barcode text not null,
    quantity integer not null check (quantity > 0),
    unit_price numeric(10, 2) not null,
    discount_percent numeric(5, 2) not null default 0.00,
    total_price numeric(10, 2) not null,
    created_at timestamptz default now()
);

create index if not exists idx_order_items_order_id on order_items (order_id);

-- 5. HELD ORDERS TABLE (Parked carts)
create table if not exists held_orders (
    id text primary key,
    held_at timestamptz not null default now(),
    customer_note text not null,
    items_json jsonb not null,
    subtotal numeric(10, 2) not null,
    total numeric(10, 2) not null,
    cashier_name text not null
);

-- 6. SHIFTS TABLE (Cashier shifts & daily Z-Reports)
create table if not exists shifts (
    id text primary key,
    cashier_name text not null,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    starting_float numeric(10, 2) not null default 200.00,
    cash_drops numeric(10, 2) not null default 0.00,
    actual_drawer_cash numeric(10, 2),
    notes text,
    is_closed boolean not null default false
);

-- 7. SETTINGS TABLE (Store configuration singleton)
create table if not exists settings (
    id integer primary key default 1 check (id = 1),
    store_name text not null default 'MINIMART EXPRESS',
    tagline text default 'Your 24/7 Neighborhood Convenience Store',
    store_address text default '124 Market Boulevard, Suite #102',
    store_phone text default '(555) 789-2044',
    tax_rate_percent numeric(5, 2) not null default 7.00,
    currency_symbol text not null default '$',
    receipt_footer text default 'Thank you for shopping with us! Please come again.',
    sound_enabled boolean not null default true,
    active_cashier text not null default 'Sarah Jenkins (Cashier #04)',
    updated_at timestamptz default now()
);

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table held_orders enable row level security;
alter table shifts enable row level security;
alter table settings enable row level security;

-- Allow public read access to products & settings (for store display & mobile catalog)
create policy "Allow read products for all" on products for select using (true);
create policy "Allow modify products for all" on products for all using (true) with check (true);

create policy "Allow all access to orders" on orders for all using (true) with check (true);
create policy "Allow all access to order_items" on order_items for all using (true) with check (true);
create policy "Allow all access to held_orders" on held_orders for all using (true) with check (true);
create policy "Allow all access to shifts" on shifts for all using (true) with check (true);
create policy "Allow all access to settings" on settings for all using (true) with check (true);

-- 9. SEED DEFAULT SETTINGS
insert into settings (id, store_name, tagline, store_address, store_phone, tax_rate_percent, currency_symbol, receipt_footer, sound_enabled, active_cashier)
values (
    1,
    'LANKA EXPRESS MINIMART',
    'Your Friendly Neighborhood Supermarket',
    'No. 142 Galle Road, Colombo 03, Sri Lanka',
    '+94 11 258 9641',
    0.00,
    'Rs.',
    'ස්තූතියි! නැවත එන්න | Thank you! Please come again.',
    true,
    'Kasun Perera (Cashier #01)'
)
on conflict (id) do nothing;

-- 10. SEED SAMPLE PRODUCTS (Sri Lankan Minimart SKUs & LKR Prices)
insert into products (id, barcode, name, category, price, cost_price, stock, reorder_level, unit, color, icon_name, is_taxable)
values
  ('prod-001', '479101100001', 'Elephant House Cream Soda 400ml (PET)', 'Beverages', 160.00, 130.00, 48, 12, 'bottle', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', 'Droplets', true),
  ('prod-002', '479101100002', 'Coca-Cola Mega 400ml Bottle', 'Beverages', 240.00, 200.00, 36, 10, 'bottle', 'bg-red-500/10 text-red-500 border-red-500/30', 'Coffee', true),
  ('prod-003', '479101100003', 'Milo Chocolate Malt UHT Pack 180ml', 'Beverages', 150.00, 125.00, 60, 15, 'pack', 'bg-green-600/10 text-green-500 border-green-600/30', 'CupSoda', true),
  ('prod-004', '479101100004', 'Knuckles Natural Mineral Water 1L', 'Beverages', 140.00, 85.00, 65, 20, 'bottle', 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', 'Droplets', false),
  ('prod-005', '479101100005', 'Smak Mango Fruit Nectar 200ml', 'Beverages', 120.00, 95.00, 30, 10, 'pack', 'bg-amber-500/10 text-amber-400 border-amber-500/30', 'Citrus', true),
  ('prod-006', '479101100006', 'Highland Pasteurized Fresh Milk 1L', 'Beverages', 480.00, 420.00, 25, 8, 'bottle', 'bg-sky-500/10 text-sky-400 border-sky-500/30', 'Milk', false),
  ('prod-007', '479101100007', 'Red Bull Energy Drink 250ml Can', 'Beverages', 850.00, 720.00, 18, 6, 'can', 'bg-blue-500/10 text-blue-400 border-blue-500/30', 'Zap', true),
  ('prod-008', '479101100008', 'Munchee Super Cream Cracker 500g', 'Snacks & Candy', 420.00, 360.00, 35, 10, 'pack', 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', 'Cookie', true),
  ('prod-009', '479101100009', 'Maliban Lemon Puff Biscuits 200g', 'Snacks & Candy', 260.00, 215.00, 40, 12, 'pack', 'bg-yellow-400/10 text-yellow-300 border-yellow-400/30', 'Cookie', true),
  ('prod-010', '479101100010', 'Munchee Hawaiian Cookies 200g', 'Snacks & Candy', 280.00, 230.00, 28, 8, 'pack', 'bg-amber-500/10 text-amber-500 border-amber-500/30', 'Cookie', true),
  ('prod-011', '479101100011', 'Tip Tip Spicy Onion Snacks 40g', 'Snacks & Candy', 100.00, 80.00, 50, 15, 'pack', 'bg-orange-500/10 text-orange-400 border-orange-500/30', 'Flame', true),
  ('prod-012', '479101100012', 'Kandos Extra Milk Chocolate 50g', 'Snacks & Candy', 220.00, 180.00, 30, 8, 'bar', 'bg-amber-800/20 text-amber-300 border-amber-700/40', 'Smile', true),
  ('prod-013', '479101100013', 'Prima Sandwich Bread Loaf 450g', 'Bakery & Fresh', 170.00, 140.00, 20, 6, 'loaf', 'bg-orange-600/10 text-orange-400 border-orange-600/30', 'Wheat', false),
  ('prod-014', '479101100014', 'Traditional Spicy Fish Bun (Maalu Paan)', 'Bakery & Fresh', 120.00, 85.00, 18, 5, 'pc', 'bg-amber-600/10 text-amber-400 border-amber-600/30', 'Sandwich', false),
  ('prod-015', '479101100015', 'Fresh Seeni Sambol Stuffed Bun', 'Bakery & Fresh', 110.00, 75.00, 15, 5, 'pc', 'bg-red-600/10 text-red-400 border-red-600/30', 'Sandwich', false),
  ('prod-016', '479101100016', 'Keells Chicken Sausage Pastry', 'Bakery & Fresh', 190.00, 145.00, 12, 4, 'pc', 'bg-yellow-600/10 text-yellow-400 border-yellow-600/30', 'Sandwich', true),
  ('prod-017', '479101100017', 'Fresh Ambul Bananas 1kg Bunch', 'Bakery & Fresh', 240.00, 170.00, 15, 4, 'kg', 'bg-yellow-400/15 text-yellow-300 border-yellow-400/40', 'Apple', false),
  ('prod-018', '479101100018', 'Sri Lankan Chicken Biriyani Packet', 'Ready-to-Eat', 750.00, 550.00, 16, 4, 'pack', 'bg-emerald-600/15 text-emerald-400 border-emerald-600/30', 'Utensils', true),
  ('prod-019', '479101100019', 'Egg Fried Rice with Devilled Sauce', 'Ready-to-Eat', 550.00, 400.00, 14, 4, 'pack', 'bg-orange-500/15 text-orange-400 border-orange-500/30', 'Utensils', true),
  ('prod-020', '479101100020', 'Maggi 2-Minute Chicken Noodles 73g', 'Ready-to-Eat', 160.00, 130.00, 40, 10, 'pack', 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', 'Soup', true),
  ('prod-021', '479101100021', 'Kist Extra Hot Chili Sauce 400g Bottle', 'Ready-to-Eat', 450.00, 375.00, 20, 5, 'bottle', 'bg-red-600/10 text-red-500 border-red-600/30', 'Flame', true),
  ('prod-022', '479101100022', 'Highland Vanilla Yoghurt Cup 80g', 'Dairy & Frozen', 80.00, 65.00, 50, 15, 'cup', 'bg-sky-500/10 text-sky-400 border-sky-500/30', 'Milk', true),
  ('prod-023', '479101100023', 'Kotmale Processed Cheese (8 Portions)', 'Dairy & Frozen', 680.00, 570.00, 20, 6, 'box', 'bg-amber-500/10 text-amber-400 border-amber-500/30', 'Package', true),
  ('prod-024', '479101100024', 'Anchor Pure Creamery Salted Butter 227g', 'Dairy & Frozen', 980.00, 840.00, 15, 5, 'block', 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40', 'Package', true),
  ('prod-025', '479101100025', 'Elephant House Vanilla Ice Cream 1L Tub', 'Dairy & Frozen', 750.00, 620.00, 12, 4, 'tub', 'bg-blue-400/10 text-blue-300 border-blue-400/30', 'IceCream', true),
  ('prod-026', '479101100026', 'Keells Smoked Chicken Sausages 500g', 'Dairy & Frozen', 890.00, 750.00, 14, 4, 'pack', 'bg-red-500/10 text-red-400 border-red-500/30', 'Package', true),
  ('prod-027', '479101100027', 'Watawala BOPF Ceylon Tea Dust 200g', 'Essentials', 480.00, 400.00, 30, 8, 'pack', 'bg-emerald-700/15 text-emerald-400 border-emerald-700/40', 'Coffee', false),
  ('prod-028', '479101100028', 'Dilmah Premium Ceylon Tea 100 Tea Bags', 'Essentials', 850.00, 720.00, 20, 6, 'box', 'bg-teal-700/15 text-teal-400 border-teal-700/40', 'Coffee', false),
  ('prod-029', '479101100029', 'White Crystal Sugar 1kg Pack', 'Essentials', 280.00, 245.00, 45, 15, 'kg', 'bg-slate-500/10 text-slate-300 border-slate-500/30', 'Package', false),
  ('prod-030', '479101100030', 'Nipuna Premium Keeri Samba Rice 1kg', 'Essentials', 340.00, 290.00, 50, 15, 'kg', 'bg-amber-400/10 text-amber-300 border-amber-400/30', 'Wheat', false),
  ('prod-031', '479101100031', 'Sunlight Yellow Laundry Soap Bar 110g', 'Household & Personal', 150.00, 125.00, 40, 10, 'bar', 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', 'Sparkles', true),
  ('prod-032', '479101100032', 'Lifebuoy Total Germ Protection Soap 100g', 'Household & Personal', 170.00, 140.00, 35, 8, 'bar', 'bg-red-500/10 text-red-400 border-red-500/30', 'Box', true),
  ('prod-033', '479101100033', 'Signal Strong Teeth Toothpaste 120g', 'Household & Personal', 260.00, 215.00, 25, 8, 'tube', 'bg-red-600/10 text-red-400 border-red-600/30', 'Smile', true),
  ('prod-034', '479101100034', 'Vim Lemon Dishwash Bar 100g', 'Household & Personal', 130.00, 105.00, 30, 8, 'bar', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', 'Sparkles', true),
  ('prod-035', '479101100035', 'Flora Soft 2-Ply Facial Tissue Box 150s', 'Household & Personal', 320.00, 260.00, 18, 5, 'box', 'bg-pink-500/10 text-pink-400 border-pink-500/30', 'Box', true),
  ('prod-036', '479101100036', 'Dettol Antiseptic Disinfectant Liquid 100ml', 'Household & Personal', 380.00, 310.00, 14, 4, 'bottle', 'bg-amber-600/10 text-amber-500 border-amber-600/30', 'Droplets', true)
on conflict (id) do nothing;

