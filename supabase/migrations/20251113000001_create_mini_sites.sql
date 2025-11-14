-- Tabela para configuração dos mini sites (tenants)
CREATE TABLE IF NOT EXISTS public.mini_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo TEXT,
  banner TEXT,
  address TEXT,
  phone TEXT,
  whatsapp_number TEXT NOT NULL,
  theme_color TEXT DEFAULT '#10B981',
  description TEXT,
  template TEXT NOT NULL CHECK (template IN ('booking', 'delivery')),

  -- Booking template fields
  operating_hours JSONB,
  available_days TEXT[],

  -- Delivery template fields
  delivery_fees JSONB,
  payment_methods TEXT[],

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, slug)
);

-- Tabela para itens do menu (serviços ou produtos)
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mini_site_id UUID NOT NULL REFERENCES public.mini_sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  duration INTEGER, -- em minutos, para template booking
  image_url TEXT,
  options JSONB, -- para template delivery (tamanhos, adicionais, etc)
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.mini_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para mini_sites
CREATE POLICY "Users can view own mini sites"
  ON public.mini_sites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mini sites"
  ON public.mini_sites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mini sites"
  ON public.mini_sites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mini sites"
  ON public.mini_sites FOR DELETE
  USING (auth.uid() = user_id);

-- Política para acesso público (leitura) via slug
CREATE POLICY "Anyone can view active mini sites by slug"
  ON public.mini_sites FOR SELECT
  USING (is_active = true);

-- Políticas RLS para menu_items
CREATE POLICY "Users can view own menu items"
  ON public.menu_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mini_sites
      WHERE mini_sites.id = menu_items.mini_site_id
      AND mini_sites.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own menu items"
  ON public.menu_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mini_sites
      WHERE mini_sites.id = menu_items.mini_site_id
      AND mini_sites.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own menu items"
  ON public.menu_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.mini_sites
      WHERE mini_sites.id = menu_items.mini_site_id
      AND mini_sites.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own menu items"
  ON public.menu_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.mini_sites
      WHERE mini_sites.id = menu_items.mini_site_id
      AND mini_sites.user_id = auth.uid()
    )
  );

-- Política para acesso público aos itens de mini sites ativos
CREATE POLICY "Anyone can view items from active mini sites"
  ON public.menu_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mini_sites
      WHERE mini_sites.id = menu_items.mini_site_id
      AND mini_sites.is_active = true
    )
  );

-- Triggers para updated_at
CREATE TRIGGER update_mini_sites_updated_at
  BEFORE UPDATE ON public.mini_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.mini_sites IS 'Configurações dos mini sites (agendamento ou delivery) por usuário';
COMMENT ON TABLE public.menu_items IS 'Itens do menu (serviços ou produtos) de cada mini site';
