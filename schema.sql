-- =====================================================================
-- ISKCON Retail ERP & Temple Inventory System
-- PostgreSQL Database Schema (Clean DDL without mock data)
-- Fully aligned with Prisma client schema for production deployment
-- =====================================================================

DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS barcode_records CASCADE;
DROP TABLE IF EXISTS sales_events CASCADE;
DROP TABLE IF EXISTS pos_order_items CASCADE;
DROP TABLE IF EXISTS pos_orders CASCADE;
DROP TABLE IF EXISTS material_inward_note_items CASCADE;
DROP TABLE IF EXISTS material_inward_notes CASCADE;
DROP TABLE IF EXISTS warehouse_zones CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- 1. Products Catalog Table
CREATE TABLE products (
    id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(128) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    min_stock INT NOT NULL DEFAULT 10,
    warehouse_zone VARCHAR(255) NOT NULL,
    batch_no VARCHAR(64),
    barcode VARCHAR(64) UNIQUE,
    image_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'in_stock',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    supplier VARCHAR(255),
    rating DECIMAL(3, 2) DEFAULT 5.0,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255)
);

-- 2. Warehouse Zones Table
CREATE TABLE warehouse_zones (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity_limit INT NOT NULL DEFAULT 1000,
    current_occupancy_percent INT NOT NULL DEFAULT 0,
    manager_in_charge VARCHAR(255),
    security_level VARCHAR(64) DEFAULT 'Standard'
);

-- 3. Material Inward Notes (GRN) Table
CREATE TABLE material_inward_notes (
    id VARCHAR(64) PRIMARY KEY,
    grn_number VARCHAR(64) UNIQUE NOT NULL,
    po_number VARCHAR(64),
    vendor_name VARCHAR(255) NOT NULL,
    invoice_date VARCHAR(64),
    warehouse VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    total_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    received_by VARCHAR(255),
    timestamp VARCHAR(64),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255)
);

-- 3.1 Material Inward Note Items Relational Table
CREATE TABLE material_inward_note_items (
    id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(10, 2),
    batch_no VARCHAR(64),
    expiry_date VARCHAR(64),
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    inward_note_id VARCHAR(64) NOT NULL,
    CONSTRAINT fk_material_inward_note FOREIGN KEY (inward_note_id) REFERENCES material_inward_notes(id) ON DELETE CASCADE
);

-- 4. POS Orders Table
CREATE TABLE pos_orders (
    id VARCHAR(64) PRIMARY KEY,
    order_number VARCHAR(64) UNIQUE NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    total DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(32) NOT NULL, -- 'cash' | 'upi' | 'card' | 'credit'
    timestamp VARCHAR(64),
    cashier_name VARCHAR(255),
    customer_phone VARCHAR(32),
    customer_name VARCHAR(255),
    sales_tag VARCHAR(128),
    upi_id VARCHAR(128),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255)
);

-- 4.1 POS Order Items Relational Table
CREATE TABLE pos_order_items (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL,
    product_sku VARCHAR(64) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_category VARCHAR(128) NOT NULL,
    product_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    custom_note TEXT,
    order_id VARCHAR(64) NOT NULL,
    CONSTRAINT fk_pos_order FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE
);

-- 5. Sales Events & Festival Stalls Table
CREATE TABLE sales_events (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL,
    start_date VARCHAR(64),
    end_date VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    target_revenue DECIMAL(12, 2) DEFAULT 0.00,
    current_revenue DECIMAL(12, 2) DEFAULT 0.00,
    allocated_skus INT DEFAULT 10,
    discount_rule VARCHAR(255),
    description TEXT,
    banner_color VARCHAR(64) DEFAULT 'bg-indigo-600',
    stall_location VARCHAR(255),
    manager_name VARCHAR(255),
    books_sold_qty INT DEFAULT 0,
    books_sold_revenue DECIMAL(12, 2) DEFAULT 0.00,
    gifts_sold_qty INT DEFAULT 0,
    gifts_sold_revenue DECIMAL(12, 2) DEFAULT 0.00,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255)
);

-- 6. Barcode Records Table
CREATE TABLE barcode_records (
    id VARCHAR(64) PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    barcode_value VARCHAR(64) NOT NULL,
    batch_no VARCHAR(64),
    format VARCHAR(32) DEFAULT 'code128',
    generated_at VARCHAR(64),
    template VARCHAR(255),
    print_count INT DEFAULT 1,
    batch_id VARCHAR(64),
    purchase_cost DECIMAL(10, 2),
    selling_price DECIMAL(10, 2)
);

-- 7. Users Table
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(64) NOT NULL,
    avatar TEXT,
    branch VARCHAR(255),
    shift VARCHAR(64),
    is_active BOOLEAN DEFAULT TRUE,
    permissions TEXT[] DEFAULT '{}',
    password VARCHAR(255) NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
