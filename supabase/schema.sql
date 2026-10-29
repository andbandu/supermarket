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
    color text,
    icon_name text,
    is_taxable boolean not null default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

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
    'MINIMART EXPRESS',
    'Your 24/7 Neighborhood Convenience Store',
    '124 Market Boulevard, Suite #102',
    '(555) 789-2044',
    7.00,
    '$',
    'Thank you for shopping with us! Please come again.',
    true,
    'Sarah Jenkins (Cashier #04)'
)
on conflict (id) do nothing;

-- 10. SEED SAMPLE PRODUCTS
insert into products (id, barcode, name, category, price, cost_price, stock, reorder_level, unit, color, icon_name, is_taxable)
values
  ('prod-001', '885012340001', 'Coca-Cola Original 330ml Can', 'Beverages', 1.50, 0.85, 48, 12, 'can', 'bg-red-500/10 text-red-600 border-red-200', 'Coffee', true),
  ('prod-002', '885012340002', 'Red Bull Energy Drink 250ml', 'Beverages', 2.80, 1.60, 24, 8, 'can', 'bg-blue-500/10 text-blue-600 border-blue-200', 'Zap', true),
  ('prod-003', '885012340003', 'Dasani Pure Spring Water 500ml', 'Beverages', 0.99, 0.35, 65, 15, 'bottle', 'bg-cyan-500/10 text-cyan-600 border-cyan-200', 'Droplets', true),
  ('prod-004', '885012340004', 'Iced Caramel Macchiato 240ml', 'Beverages', 2.50, 1.25, 14, 6, 'bottle', 'bg-amber-500/10 text-amber-700 border-amber-200', 'Coffee', true),
  ('prod-005', '885012340005', 'Pokka Japanese Green Tea 500ml', 'Beverages', 1.75, 0.90, 30, 10, 'bottle', 'bg-emerald-500/10 text-emerald-600 border-emerald-200', 'CupSoda', true),
  ('prod-006', '885012340006', 'Tropicana Orange Juice 100% 350ml', 'Beverages', 2.20, 1.10, 18, 5, 'bottle', 'bg-orange-500/10 text-orange-600 border-orange-200', 'Citrus', true),
  ('prod-007', '885012340007', 'Lay''s Classic Salted Potato Chips 50g', 'Snacks & Candy', 1.85, 0.95, 35, 10, 'pack', 'bg-yellow-500/10 text-yellow-600 border-yellow-200', 'Cookie', true),
  ('prod-008', '885012340008', 'Pringles Sour Cream & Onion 107g', 'Snacks & Candy', 2.95, 1.70, 22, 8, 'tube', 'bg-green-500/10 text-green-600 border-green-200', 'Package', true),
  ('prod-009', '885012340009', 'KitKat 4-Finger Milk Chocolate 45g', 'Snacks & Candy', 1.25, 0.60, 40, 12, 'bar', 'bg-red-500/10 text-red-600 border-red-200', 'Candy', true),
  ('prod-010', '885012340010', 'Snickers King Size Peanut Bar 72g', 'Snacks & Candy', 1.95, 1.05, 28, 8, 'bar', 'bg-amber-500/10 text-amber-700 border-amber-200', 'Candy', true),
  ('prod-011', '885012340011', 'Haribo Goldbears Gummy 100g', 'Snacks & Candy', 2.10, 1.05, 19, 6, 'pack', 'bg-purple-500/10 text-purple-600 border-purple-200', 'Sparkles', true),
  ('prod-012', '885012340012', 'Oreo Original Sandwich Cookies 133g', 'Snacks & Candy', 1.65, 0.80, 32, 10, 'pack', 'bg-blue-500/10 text-blue-600 border-blue-200', 'Cookie', true),
  ('prod-013', '885012340013', 'Whole Grain Sliced Sandwich Bread', 'Bakery & Fresh', 2.75, 1.50, 8, 5, 'loaf', 'bg-amber-500/10 text-amber-600 border-amber-200', 'Wheat', false),
  ('prod-014', '885012340014', 'Fresh Whole Milk 1L Carton', 'Bakery & Fresh', 3.20, 2.10, 4, 6, 'carton', 'bg-sky-500/10 text-sky-600 border-sky-200', 'Milk', false),
  ('prod-015', '885012340015', 'Egg & Cheddar Breakfast Sandwich', 'Bakery & Fresh', 3.80, 2.20, 11, 4, 'pack', 'bg-yellow-500/10 text-yellow-700 border-yellow-200', 'Sandwich', true),
  ('prod-016', '885012340016', 'Fresh Cavendish Bananas (Bunch ~800g)', 'Bakery & Fresh', 1.90, 0.90, 15, 5, 'bunch', 'bg-lime-500/10 text-lime-600 border-lime-200', 'Apple', false),
  ('prod-017', '885012340017', 'Nissin Cup Noodles Seafood 75g', 'Ready-to-Eat', 1.95, 1.05, 45, 12, 'cup', 'bg-red-500/10 text-red-600 border-red-200', 'Utensils', true),
  ('prod-018', '885012340018', 'Hot & Spicy Chicken Bento Box', 'Ready-to-Eat', 5.50, 3.20, 7, 4, 'box', 'bg-rose-500/10 text-rose-600 border-rose-200', 'Utensils', true),
  ('prod-019', '885012340019', 'Steamed BBQ Pork Bao (2 Pcs)', 'Ready-to-Eat', 2.60, 1.30, 12, 5, 'pack', 'bg-amber-500/10 text-amber-600 border-amber-200', 'Soup', true),
  ('prod-020', '885012340020', 'Haagen-Dazs Vanilla Mini Cup 100ml', 'Dairy & Frozen', 3.90, 2.40, 16, 6, 'cup', 'bg-indigo-500/10 text-indigo-600 border-indigo-200', 'IceCream', true),
  ('prod-021', '885012340021', 'Greek Style Strawberry Yogurt 150g', 'Dairy & Frozen', 1.80, 0.95, 14, 5, 'tub', 'bg-pink-500/10 text-pink-600 border-pink-200', 'Milk', true),
  ('prod-022', '885012340022', 'Colgate Total Clean Mint Toothpaste 100g', 'Household & Personal', 3.40, 1.90, 20, 6, 'tube', 'bg-teal-500/10 text-teal-600 border-teal-200', 'Smile', true),
  ('prod-023', '885012340023', 'Soft Facial Pocket Tissues 3-ply (8 packs)', 'Household & Personal', 1.50, 0.70, 36, 10, 'pack', 'bg-slate-500/10 text-slate-600 border-slate-200', 'Box', true),
  ('prod-024', '885012340024', 'AA Alkaline Batteries (4-Pack)', 'Household & Personal', 4.50, 2.20, 15, 5, 'pack', 'bg-yellow-500/10 text-yellow-600 border-yellow-200', 'BatteryCharging', true),
  ('prod-025', '885012340025', 'Wrigley Spearmint Chewing Gum 15 sticks', 'Essentials', 1.10, 0.50, 50, 15, 'pack', 'bg-emerald-500/10 text-emerald-600 border-emerald-200', 'Sparkles', true),
  ('prod-026', '885012340026', 'Bic Maxi Pocket Lighter (Assorted Colors)', 'Essentials', 1.80, 0.85, 30, 8, 'pc', 'bg-red-500/10 text-red-600 border-red-200', 'Flame', true),
  ('prod-027', '885012340027', 'USB Type-C Fast Charging Cable 1M', 'Essentials', 6.90, 2.80, 9, 4, 'pc', 'bg-violet-500/10 text-violet-600 border-violet-200', 'Cable', true)
on conflict (id) do nothing;

