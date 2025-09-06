-- Postgres initialization for WarehouseWizard
-- Aligns with Mongoose models in project/shared/schema.ts

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer','purchase_support','sales_support','supervisor','warehouse','accounts','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE storage_type AS ENUM ('cold_storage','dry_storage','hazmat','climate_controlled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM ('pending','processing','quoted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending','confirmed','active','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cargo_status AS ENUM ('submitted','approved','processing','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('requested','scheduled','in_transit','delivered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_urgency AS ENUM ('standard','express','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft','sent','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  mobile           TEXT,
  company          TEXT,
  role             user_role NOT NULL DEFAULT 'customer',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- OTP verifications
CREATE TABLE IF NOT EXISTS otp_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('email','mobile')),
  code        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  is_used     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_verifications(user_id);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  location         TEXT NOT NULL,
  city             TEXT NOT NULL,
  state            TEXT NOT NULL,
  storage_type     storage_type NOT NULL,
  total_space      INTEGER NOT NULL,
  available_space  INTEGER NOT NULL,
  price_per_sq_ft  DOUBLE PRECISION NOT NULL,
  features         JSONB,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_city ON warehouses(city);
CREATE INDEX IF NOT EXISTS idx_warehouses_state ON warehouses(state);
CREATE INDEX IF NOT EXISTS idx_warehouses_storage_type ON warehouses(storage_type);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_type        TEXT NOT NULL,
  required_space      INTEGER NOT NULL,
  preferred_location  TEXT NOT NULL,
  duration            TEXT NOT NULL,
  special_requirements TEXT,
  status              quote_status NOT NULL DEFAULT 'pending',
  assigned_to         UUID REFERENCES users(id) ON DELETE SET NULL,
  final_price         DOUBLE PRECISION,
  warehouse_id        UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_assigned_to ON quotes(assigned_to);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  status        booking_status NOT NULL DEFAULT 'pending',
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  total_amount  DOUBLE PRECISION NOT NULL,
  approved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_warehouse ON bookings(warehouse_id);

-- Cargo Dispatch Details
CREATE TABLE IF NOT EXISTS cargo_dispatch_details (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  weight           DOUBLE PRECISION,
  dimensions       TEXT,
  special_handling TEXT,
  status           cargo_status NOT NULL DEFAULT 'submitted',
  approved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargo_booking ON cargo_dispatch_details(booking_id);
CREATE INDEX IF NOT EXISTS idx_cargo_status ON cargo_dispatch_details(status);

-- Delivery Requests
CREATE TABLE IF NOT EXISTS delivery_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_address TEXT NOT NULL,
  preferred_date   DATE NOT NULL,
  urgency          delivery_urgency NOT NULL DEFAULT 'standard',
  status           delivery_status NOT NULL DEFAULT 'requested',
  assigned_driver  TEXT,
  tracking_number  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_customer ON delivery_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_requests(status);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL UNIQUE,
  amount          DOUBLE PRECISION NOT NULL,
  status          invoice_status NOT NULL DEFAULT 'draft',
  due_date        DATE NOT NULL,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Unified Form Submissions (captures 7 types with JSONB payload)
-- Types observed in frontend: domestic_dry, bonded_dry, bonded_reefer,
-- cfs_import, cfs_export, cfs_export_dry, refer_domestic_warehouse
DO $$ BEGIN
  CREATE TYPE form_type AS ENUM (
    'domestic_dry', 'bonded_dry', 'bonded_reefer',
    'cfs_import', 'cfs_export', 'cfs_export_dry', 'refer_domestic_warehouse'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS form_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID REFERENCES users(id) ON DELETE SET NULL, -- nullable for guests
  warehouse_id  UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  quote_id      UUID REFERENCES quotes(id) ON DELETE SET NULL,
  type          form_type NOT NULL,
  data          JSONB NOT NULL, -- raw validated payload from each form
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_type ON form_submissions(type);
CREATE INDEX IF NOT EXISTS idx_form_submissions_customer ON form_submissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_warehouse ON form_submissions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_quote ON form_submissions(quote_id);
-- helpful GIN index for querying inside JSON payloads
CREATE INDEX IF NOT EXISTS idx_form_submissions_data_gin ON form_submissions USING GIN (data);

-- Triggers to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  PERFORM 1;
  -- users
  CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_cargo_updated_at BEFORE UPDATE ON cargo_dispatch_details FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_delivery_updated_at BEFORE UPDATE ON delivery_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_form_submissions_updated_at BEFORE UPDATE ON form_submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

