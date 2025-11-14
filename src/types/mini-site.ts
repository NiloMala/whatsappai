export type TemplateType = 'booking' | 'delivery';

export interface ProductOption {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  mini_site_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  duration?: number; // em minutos, para template booking
  image_url?: string;
  options?: ProductOption[]; // para template delivery
  available?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryFee {
  id: string;
  location: string;
  fee: number;
}

export interface OperatingHours {
  start: string;
  end: string;
}

export interface MiniSite {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  logo?: string;
  banner?: string;
  address?: string;
  phone?: string;
  whatsapp_number: string;
  theme_color: string;
  background_color?: string | null;
  button_color?: string | null;
  text_color?: string | null;
  description?: string;
  template: TemplateType;
  // Booking template fields
  operating_hours?: OperatingHours;
  available_days?: string[];
  // Delivery template fields
  delivery_fees?: DeliveryFee[];
  payment_methods?: string[];
  delivery_info?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MiniSiteFormData {
  name: string;
  slug: string;
  logo?: string;
  banner?: string;
  address?: string;
  phone?: string;
  whatsapp_number: string;
  theme_color: string;
  description?: string;
  template: TemplateType;
  operating_hours?: OperatingHours;
  available_days?: string[];
  delivery_fees?: DeliveryFee[];
  payment_methods?: string[];
  delivery_info?: string;
}

export interface MenuItemFormData {
  title: string;
  description: string;
  price: number;
  category: string;
  duration?: number;
  image_url?: string;
  options?: ProductOption[];
  available?: boolean;
}
