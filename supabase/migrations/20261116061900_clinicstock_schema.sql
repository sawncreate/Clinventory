BEGIN;

CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.stock_movement_type AS ENUM ('in', 'out');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  full_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  contact_name text,
  email text,
  phone text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL CHECK (length(btrim(sku)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,
  category_id uuid REFERENCES public.categories (id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  unit text NOT NULL CHECK (length(btrim(unit)) > 0),
  initial_stock integer NOT NULL DEFAULT 0 CHECK (initial_stock >= 0),
  current_stock integer NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  minimum_stock integer NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  movement_type public.stock_movement_type NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  transaction_date date NOT NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_supplier_only_for_stock_in
    CHECK (supplier_id IS NULL OR movement_type = 'in')
);

CREATE UNIQUE INDEX categories_name_ci_uidx
  ON public.categories (lower(btrim(name)));
CREATE UNIQUE INDEX suppliers_name_ci_uidx
  ON public.suppliers (lower(btrim(name)));
CREATE UNIQUE INDEX items_sku_ci_uidx
  ON public.items (upper(btrim(sku)));
CREATE INDEX items_category_id_idx ON public.items (category_id);
CREATE INDEX items_supplier_id_idx ON public.items (supplier_id);
CREATE INDEX stock_movements_item_created_at_idx
  ON public.stock_movements (item_id, created_at DESC);
CREATE INDEX stock_movements_transaction_date_idx
  ON public.stock_movements (transaction_date DESC);
CREATE INDEX stock_movements_created_by_created_at_idx
  ON public.stock_movements (created_by, created_at DESC);
CREATE INDEX stock_movements_supplier_id_idx
  ON public.stock_movements (supplier_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER items_set_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER stock_movements_set_updated_at
  BEFORE UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.initialize_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.current_stock := NEW.initial_stock;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER items_initialize_stock
  BEFORE INSERT ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.initialize_item_stock();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'staff');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user_profile();

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
    AND p.is_active
$function$;

CREATE OR REPLACE FUNCTION public.set_profile_role(
  p_profile_id uuid,
  p_role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Only an active admin can change profile roles.'
      USING ERRCODE = '42501';
  END IF;

  IF p_profile_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'A profile and role are required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_profile_id = v_actor_id THEN
    RAISE EXCEPTION 'Admins cannot change their own role.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET role = p_role
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_item_id uuid,
  p_movement_type public.stock_movement_type,
  p_quantity integer,
  p_transaction_date date,
  p_notes text DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_role public.app_role;
  v_current_stock integer;
  v_movement_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  v_role := public.current_app_role();
  IF v_role IS NULL OR v_role NOT IN (
    'admin'::public.app_role,
    'staff'::public.app_role
  ) THEN
    RAISE EXCEPTION 'An active admin or staff profile is required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_item_id IS NULL
    OR p_movement_type IS NULL
    OR p_quantity IS NULL
    OR p_quantity <= 0
    OR p_transaction_date IS NULL
  THEN
    RAISE EXCEPTION 'An item, movement type, positive quantity, and transaction date are required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_supplier_id IS NOT NULL THEN
    IF p_movement_type <> 'in'::public.stock_movement_type THEN
      RAISE EXCEPTION 'A supplier can only be recorded for Stock In.'
        USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM public.suppliers AS s
    WHERE s.id = p_supplier_id
      AND s.is_active;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Supplier not found or inactive.'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  SELECT i.current_stock
  INTO v_current_stock
  FROM public.items AS i
  WHERE i.id = p_item_id
    AND i.is_active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found or inactive.'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_movement_type = 'out'::public.stock_movement_type
    AND v_current_stock < p_quantity
  THEN
    RAISE EXCEPTION 'Insufficient stock.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.items
  SET current_stock = CASE p_movement_type
    WHEN 'in'::public.stock_movement_type THEN current_stock + p_quantity
    WHEN 'out'::public.stock_movement_type THEN current_stock - p_quantity
  END
  WHERE id = p_item_id;

  INSERT INTO public.stock_movements (
    item_id,
    supplier_id,
    movement_type,
    quantity,
    transaction_date,
    notes,
    created_by
  )
  VALUES (
    p_item_id,
    p_supplier_id,
    p_movement_type,
    p_quantity,
    p_transaction_date,
    p_notes,
    v_actor_id
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$function$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_self_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.current_app_role() = 'admin'::public.app_role
  );

CREATE POLICY categories_select_active_roles
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() IN (
      'admin'::public.app_role,
      'staff'::public.app_role
    )
  );
CREATE POLICY categories_insert_admin
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_app_role() = 'admin'::public.app_role);
CREATE POLICY categories_update_admin
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (public.current_app_role() = 'admin'::public.app_role)
  WITH CHECK (public.current_app_role() = 'admin'::public.app_role);
CREATE POLICY categories_delete_admin
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'admin'::public.app_role);

CREATE POLICY suppliers_select_active_roles
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() IN (
      'admin'::public.app_role,
      'staff'::public.app_role
    )
  );
CREATE POLICY suppliers_insert_admin
  ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_app_role() = 'admin'::public.app_role);
CREATE POLICY suppliers_update_admin
  ON public.suppliers
  FOR UPDATE
  TO authenticated
  USING (public.current_app_role() = 'admin'::public.app_role)
  WITH CHECK (public.current_app_role() = 'admin'::public.app_role);
CREATE POLICY suppliers_delete_admin
  ON public.suppliers
  FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'admin'::public.app_role);

CREATE POLICY items_select_active_roles
  ON public.items
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() IN (
      'admin'::public.app_role,
      'staff'::public.app_role
    )
  );
CREATE POLICY items_insert_admin
  ON public.items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_app_role() = 'admin'::public.app_role);
CREATE POLICY items_update_admin
  ON public.items
  FOR UPDATE
  TO authenticated
  USING (public.current_app_role() = 'admin'::public.app_role)
  WITH CHECK (public.current_app_role() = 'admin'::public.app_role);
CREATE POLICY items_delete_admin
  ON public.items
  FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'admin'::public.app_role);

CREATE POLICY stock_movements_select_active_roles
  ON public.stock_movements
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() IN (
      'admin'::public.app_role,
      'staff'::public.app_role
    )
  );

REVOKE ALL ON TABLE
  public.profiles,
  public.categories,
  public.suppliers,
  public.items,
  public.stock_movements
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.profiles,
  public.categories,
  public.suppliers,
  public.items,
  public.stock_movements
TO authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  public.categories,
  public.suppliers
TO authenticated;

GRANT INSERT (
  sku,
  name,
  description,
  category_id,
  supplier_id,
  unit,
  initial_stock,
  minimum_stock,
  is_active
)
ON public.items TO authenticated;

GRANT UPDATE (
  sku,
  name,
  description,
  category_id,
  supplier_id,
  unit,
  minimum_stock,
  is_active
)
ON public.items TO authenticated;

GRANT DELETE ON TABLE public.items TO authenticated;

REVOKE ALL ON TYPE public.app_role, public.stock_movement_type
FROM PUBLIC, anon;
GRANT USAGE ON TYPE public.app_role, public.stock_movement_type
TO authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.initialize_item_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_profile_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_stock_movement(
  uuid,
  public.stock_movement_type,
  integer,
  date,
  text,
  uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_profile_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(
  uuid,
  public.stock_movement_type,
  integer,
  date,
  text,
  uuid
) TO authenticated;

COMMIT;
