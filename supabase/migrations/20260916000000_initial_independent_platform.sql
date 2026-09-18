-- ENUMS
CREATE TYPE public.app_role AS ENUM ('client','artisan','admin');
CREATE TYPE public.product_status AS ENUM ('draft','published','inactive');
CREATE TYPE public.order_status AS ENUM ('placed','paid','preparing','shipping','delivered','cancelled');
CREATE TYPE public.payment_status AS ENUM ('awaiting','confirmed','refused','cancelled');
CREATE TYPE public.movement_type AS ENUM ('in','out','adjust','sale','cancellation');
CREATE TYPE public.cost_type AS ENUM ('fixed','variable');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  city TEXT,
  state TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- SIGNUP TRIGGER
-- The Auth trigger is installed after all application tables/functions exist.

-- ARTISAN PROFILES
CREATE TABLE public.artisan_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  bio TEXT,
  story TEXT,
  city TEXT,
  state TEXT DEFAULT 'CE',
  specialties TEXT[] NOT NULL DEFAULT '{}',
  avatar_url TEXT,
  cover_url TEXT,
  instagram TEXT,
  whatsapp TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.artisan_profiles TO authenticated;
GRANT SELECT ON public.artisan_profiles TO anon;
GRANT ALL ON public.artisan_profiles TO service_role;
ALTER TABLE public.artisan_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artisans_select_all" ON public.artisan_profiles FOR SELECT USING (true);
CREATE POLICY "artisans_insert_own" ON public.artisan_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "artisans_update_own" ON public.artisan_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_artisans_updated BEFORE UPDATE ON public.artisan_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "categories_admin" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES public.artisan_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  labor_cents INTEGER NOT NULL DEFAULT 0,
  fixed_cost_cents INTEGER NOT NULL DEFAULT 0,
  variable_cost_cents INTEGER NOT NULL DEFAULT 0,
  profit_margin NUMERIC(6,2) NOT NULL DEFAULT 30,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock INTEGER NOT NULL DEFAULT 1,
  production_days INTEGER,
  main_material TEXT,
  origin_city TEXT,
  weight_grams INTEGER,
  dimensions TEXT,
  status public.product_status NOT NULL DEFAULT 'draft',
  sales_count INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(2,1),
  rating_count INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.owns_artisan(_artisan_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.artisan_profiles a WHERE a.id = _artisan_id AND a.user_id = auth.uid());
$$;

CREATE POLICY "products_select_public" ON public.products FOR SELECT USING (status = 'published' OR public.owns_artisan(artisan_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "products_insert_own" ON public.products FOR INSERT TO authenticated WITH CHECK (public.owns_artisan(artisan_id));
CREATE POLICY "products_update_own" ON public.products FOR UPDATE TO authenticated USING (public.owns_artisan(artisan_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.owns_artisan(artisan_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "products_delete_own" ON public.products FOR DELETE TO authenticated USING (public.owns_artisan(artisan_id) OR public.has_role(auth.uid(),'admin'));

-- PRODUCT IMAGES
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_images_select" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "product_images_manage" ON public.product_images FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (public.owns_artisan(p.artisan_id) OR public.has_role(auth.uid(),'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (public.owns_artisan(p.artisan_id) OR public.has_role(auth.uid(),'admin'))));

-- MATERIALS
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES public.artisan_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_own" ON public.materials FOR ALL TO authenticated USING (public.owns_artisan(artisan_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.owns_artisan(artisan_id));
CREATE TRIGGER trg_materials_updated BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCT MATERIALS (BOM)
CREATE TABLE public.product_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  quantity_required NUMERIC(12,3) NOT NULL DEFAULT 0,
  UNIQUE (product_id, material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_materials TO authenticated;
GRANT SELECT ON public.product_materials TO anon;
GRANT ALL ON public.product_materials TO service_role;
ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bom_select" ON public.product_materials FOR SELECT USING (true);
CREATE POLICY "bom_manage" ON public.product_materials FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.owns_artisan(p.artisan_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.owns_artisan(p.artisan_id)));

-- COSTS
CREATE TABLE public.costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES public.artisan_profiles(id) ON DELETE CASCADE,
  type public.cost_type NOT NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costs TO authenticated;
GRANT ALL ON public.costs TO service_role;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "costs_own" ON public.costs FOR ALL TO authenticated USING (public.owns_artisan(artisan_id)) WITH CHECK (public.owns_artisan(artisan_id));

-- FAVORITES
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_own" ON public.favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CART
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_own" ON public.cart_items FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_cart_updated BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ADDRESSES
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses_own" ON public.addresses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGSERIAL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_cents INTEGER NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'placed',
  payment_status public.payment_status NOT NULL DEFAULT 'awaiting',
  payment_method TEXT NOT NULL DEFAULT 'pix',
  address_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  artisan_id UUID REFERENCES public.artisan_profiles(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  image_url TEXT,
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL
);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.order_belongs_to_artisan(_order_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.artisan_profiles a ON a.id = oi.artisan_id
    WHERE oi.order_id = _order_id AND a.user_id = auth.uid()
  );
$$;

CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.order_belongs_to_artisan(id));
CREATE POLICY "orders_update_staff" ON public.orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.order_belongs_to_artisan(id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.order_belongs_to_artisan(id));

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  OR public.owns_artisan(artisan_id));

-- STOCK MOVEMENTS
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES public.artisan_profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  type public.movement_type NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  reason TEXT,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements_select_own" ON public.stock_movements FOR SELECT TO authenticated USING (public.owns_artisan(artisan_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "movements_insert_own" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.owns_artisan(artisan_id));

-- ORDER STATUS HISTORY
CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_select" ON public.order_status_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.order_belongs_to_artisan(o.id))));
CREATE POLICY "history_insert_staff" ON public.order_status_history FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.order_belongs_to_artisan(order_id));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CHECKOUT FUNCTION (transactional)
CREATE OR REPLACE FUNCTION public.place_order(_address_id UUID, _payment_method TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_addr public.addresses%ROWTYPE;
  v_order_id UUID;
  v_total INTEGER := 0;
  r RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Nao autenticado'; END IF;
  IF _payment_method NOT IN ('pix','card','on_delivery') THEN RAISE EXCEPTION 'Forma de pagamento invalida'; END IF;
  SELECT * INTO v_addr FROM public.addresses WHERE id = _address_id AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Endereco invalido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cart_items WHERE user_id = v_user) THEN RAISE EXCEPTION 'Carrinho vazio'; END IF;

  INSERT INTO public.orders (user_id, total_cents, payment_method, address_snapshot)
  VALUES (v_user, 0, _payment_method, to_jsonb(v_addr)) RETURNING id INTO v_order_id;

  FOR r IN
    SELECT c.product_id, c.quantity, p.name, p.price_cents, p.stock_quantity, p.artisan_id, p.status, p.image_url, p.minimum_stock
    FROM public.cart_items c
    JOIN public.products p ON p.id = c.product_id
    WHERE c.user_id = v_user
    FOR UPDATE OF p
  LOOP
    IF r.status <> 'published' THEN RAISE EXCEPTION 'Produto indisponivel: %', r.name; END IF;
    IF r.stock_quantity < r.quantity THEN RAISE EXCEPTION 'Estoque insuficiente para %', r.name; END IF;

    INSERT INTO public.order_items (order_id, product_id, artisan_id, product_name_snapshot, image_url, unit_price_cents, quantity, subtotal_cents)
    VALUES (v_order_id, r.product_id, r.artisan_id, r.name, r.image_url, r.price_cents, r.quantity, r.price_cents * r.quantity);

    UPDATE public.products
      SET stock_quantity = stock_quantity - r.quantity,
          sales_count = sales_count + r.quantity
      WHERE id = r.product_id;

    INSERT INTO public.stock_movements (artisan_id, product_id, type, quantity, reason, reference_id, created_by)
    VALUES (r.artisan_id, r.product_id, 'sale', r.quantity, 'Venda - pedido', v_order_id, v_user);

    IF (r.stock_quantity - r.quantity) <= r.minimum_stock THEN
      INSERT INTO public.notifications (user_id, type, title, body)
      SELECT a.user_id, 'stock', 'Estoque baixo', r.name || ' esta com estoque baixo.'
      FROM public.artisan_profiles a WHERE a.id = r.artisan_id;
    END IF;

    v_total := v_total + (r.price_cents * r.quantity);
  END LOOP;

  UPDATE public.orders SET total_cents = v_total WHERE id = v_order_id;
  INSERT INTO public.order_status_history (order_id, status, changed_by) VALUES (v_order_id, 'placed', v_user);
  DELETE FROM public.cart_items WHERE user_id = v_user;
  RETURN v_order_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.place_order(UUID, TEXT) TO authenticated;

-- CANCEL ORDER (returns stock)
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_order public.orders%ROWTYPE; r RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado'; END IF;
  IF NOT (v_order.user_id = v_user OR public.has_role(v_user,'admin') OR public.order_belongs_to_artisan(_order_id)) THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;
  IF v_order.status IN ('cancelled','delivered') THEN RAISE EXCEPTION 'Pedido nao pode ser cancelado'; END IF;

  FOR r IN SELECT product_id, quantity, artisan_id FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL LOOP
    UPDATE public.products SET stock_quantity = stock_quantity + r.quantity,
      sales_count = GREATEST(sales_count - r.quantity, 0) WHERE id = r.product_id;
    INSERT INTO public.stock_movements (artisan_id, product_id, type, quantity, reason, reference_id, created_by)
    VALUES (r.artisan_id, r.product_id, 'cancellation', r.quantity, 'Cancelamento de pedido', _order_id, v_user);
  END LOOP;

  UPDATE public.orders SET status = 'cancelled', payment_status = 'cancelled' WHERE id = _order_id;
  INSERT INTO public.order_status_history (order_id, status, changed_by) VALUES (_order_id, 'cancelled', v_user);
END; $$;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID) TO authenticated;

-- SEED CATEGORIES
INSERT INTO public.categories (slug, name, description) VALUES
 ('ceramica','Cerâmica','Tradição em cada detalhe'),
 ('textil','Têxtil','Cores e simbologia do nosso povo'),
 ('madeira','Madeira','Arte que nasce das mãos'),
 ('palha','Palha','Beleza e utilidade do sertão'),
 ('decoracao','Decoração','O Nordeste em seu lar');

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.owns_artisan(uuid) SET SCHEMA private;
ALTER FUNCTION public.order_belongs_to_artisan(uuid) SET SCHEMA private;
ALTER FUNCTION public.set_updated_at() SET SCHEMA private;

ALTER FUNCTION private.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION private.owns_artisan(uuid) SET search_path = public;
ALTER FUNCTION private.order_belongs_to_artisan(uuid) SET search_path = public;
ALTER FUNCTION private.set_updated_at() SET search_path = public;

REVOKE ALL ON FUNCTION public.place_order(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;

DROP POLICY IF EXISTS "images_read" ON storage.objects;
DROP POLICY IF EXISTS "images_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "images_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "images_delete_own_folder" ON storage.objects;

CREATE POLICY "images_read" ON storage.objects FOR SELECT TO authenticated, anon
USING (bucket_id IN ('product-images','avatars'));

CREATE POLICY "images_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('product-images','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "images_update_own_folder" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('product-images','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "images_delete_own_folder" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('product-images','avatars') AND (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================
-- INDEPENDENT PLATFORM LAYER
-- Plans, subscriptions, payments, content management and admin tools.
-- ============================================================

CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);
GRANT SELECT ON public.subcategories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
GRANT ALL ON public.subcategories TO service_role;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subcategories_select_public" ON public.subcategories FOR SELECT USING (active OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "subcategories_admin" ON public.subcategories FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_subcategories_updated BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience TEXT NOT NULL CHECK (audience IN ('client','artisan')),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('free','monthly','yearly')),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  boost_priority INTEGER NOT NULL DEFAULT 0 CHECK (boost_priority >= 0),
  store_profile_level INTEGER NOT NULL DEFAULT 0 CHECK (store_profile_level >= 0),
  product_feature_level INTEGER NOT NULL DEFAULT 0 CHECK (product_feature_level >= 0),
  product_limit INTEGER,
  image_limit INTEGER,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_select_public" ON public.plans FOR SELECT USING (active OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "plans_admin" ON public.plans FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing','active','past_due','cancelled','expired','paused')),
  provider TEXT,
  external_customer_id TEXT,
  external_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_select_own_or_admin" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "subscriptions_admin" ON public.subscriptions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE UNIQUE INDEX subscriptions_one_open_per_user ON public.subscriptions(user_id)
  WHERE status IN ('trialing','active','past_due','paused');

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting','paid','failed','refunded','cancelled')),
  provider TEXT,
  external_payment_id TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select_own_or_admin" ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "payments_admin" ON public.payments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners_select_public" ON public.banners FOR SELECT USING (
  active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now())
  OR private.has_role(auth.uid(),'admin')
);
CREATE POLICY "banners_admin" ON public.banners FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_banners_updated BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_settings_admin" ON public.site_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_site_settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'));

-- Admin role management. The first administrator is intentionally bootstrapped manually
-- in SQL so no anonymous/browser user can grant themselves admin access.
CREATE OR REPLACE FUNCTION public.set_user_admin(_target_user UUID, _make_admin BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    IF _target_user = auth.uid() AND
       (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'Nao e permitido remover o ultimo administrador';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _target_user AND role = 'admin';
  END IF;

  INSERT INTO public.audit_logs(actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN _make_admin THEN 'grant_admin' ELSE 'revoke_admin' END,
          'user', _target_user, jsonb_build_object('admin', _make_admin));
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_user_admin(UUID, BOOLEAN) TO authenticated;

-- Existing Auth users created before the database schema existed are backfilled.
INSERT INTO public.profiles (id, name, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'name', split_part(COALESCE(u.email,''),'@',1)),
       u.email
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET name = COALESCE(NULLIF(public.profiles.name,''), EXCLUDED.name),
    email = COALESCE(public.profiles.email, EXCLUDED.email);

INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
       CASE WHEN u.raw_user_meta_data->>'role' IN ('artisan','admin')
            THEN (u.raw_user_meta_data->>'role')::public.app_role
            ELSE 'client'::public.app_role END
FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.artisan_profiles (user_id, store_name)
SELECT u.id, COALESCE(NULLIF(u.raw_user_meta_data->>'name',''), 'Minha loja')
FROM auth.users u
WHERE u.raw_user_meta_data->>'role' = 'artisan'
ON CONFLICT (user_id) DO NOTHING;

-- Default plans. Prices and benefits are editable from the admin layer.
INSERT INTO public.plans
  (audience, slug, name, description, price_cents, billing_interval, sort_order,
   boost_priority, store_profile_level, product_feature_level, product_limit, image_limit, benefits)
VALUES
  ('artisan','artisan-free','Artesão Gratuito','Presença básica na plataforma',0,'free',1,1,0,0,10,3,
   '["Cadastro de produtos","Presença na busca","Gestão básica de estoque"]'::jsonb),
  ('artisan','artisan-boost','Artesão Boost','Mais alcance para sua vitrine',990,'monthly',2,2,0,0,30,5,
   '["Tudo do Gratuito","Impulsionamento maior"]'::jsonb),
  ('artisan','artisan-store','Artesão Loja','Mais recursos para sua loja',1990,'monthly',3,3,1,0,100,8,
   '["Tudo do Boost","Recursos extras de loja e perfil"]'::jsonb),
  ('artisan','artisan-pro','Artesão Pro','Recursos completos para produtos',3990,'monthly',4,4,1,1,NULL,15,
   '["Tudo da Loja","Recursos extras para produtos","Maior prioridade de destaque"]'::jsonb),
  ('client','client-free','Cliente Gratuito','Compra e favoritos',0,'free',1,0,0,0,NULL,NULL,
   '["Explorar peças","Favoritar produtos","Comprar"]'::jsonb),
  ('client','client-premium','Cliente Premium','Benefícios premium configuráveis',1490,'monthly',2,0,0,0,NULL,NULL,
   '["Tudo do Gratuito","Benefícios premium configuráveis"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Storage buckets used by the app.
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images','product-images',true), ('avatars','avatars',true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Helpful indexes for the marketplace and admin screens.
CREATE INDEX IF NOT EXISTS products_published_created_idx
  ON public.products(status, created_at DESC);
CREATE INDEX IF NOT EXISTS products_artisan_created_idx
  ON public.products(artisan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS products_category_idx
  ON public.products(category_id);
CREATE INDEX IF NOT EXISTS artisan_profiles_user_idx
  ON public.artisan_profiles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_user_role_idx
  ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS banners_active_order_idx
  ON public.banners(active, sort_order);
CREATE INDEX IF NOT EXISTS subcategories_category_order_idx
  ON public.subcategories(category_id, sort_order);

-- Assign the free plan automatically at signup. This is intentionally kept after
-- the plans table exists so the Auth trigger can safely use it.
CREATE OR REPLACE FUNCTION private.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE requested TEXT;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  requested := COALESCE(NEW.raw_user_meta_data->>'role','client');
  IF requested NOT IN ('client','artisan') THEN requested := 'client'; END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF requested = 'artisan' THEN
    INSERT INTO public.artisan_profiles (user_id, store_name)
    VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'name',''), 'Minha loja'))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  INSERT INTO public.subscriptions (user_id, plan_id, status)
  SELECT NEW.id, p.id, 'active'
  FROM public.plans p
  WHERE p.slug = CASE WHEN requested = 'artisan' THEN 'artisan-free' ELSE 'client-free' END
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- Install the Auth trigger only after the final handler exists and all referenced tables exist.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- Backfill a free subscription for users already present.
INSERT INTO public.subscriptions (user_id, plan_id, status)
SELECT u.id, p.id, 'active'
FROM auth.users u
JOIN public.plans p
  ON p.slug = CASE WHEN u.raw_user_meta_data->>'role' = 'artisan' THEN 'artisan-free' ELSE 'client-free' END
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id
)
ON CONFLICT DO NOTHING;
