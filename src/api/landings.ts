import apiClient from './client';

// ============================================================
// Public types
// ============================================================

export interface LandingFeature {
  icon: string;
  title: string;
  description: string;
}

export interface LandingTariffPeriod {
  days: number;
  label: string;
  price_kopeks: number;
  price_label: string;
}

export interface LandingTariff {
  id: number;
  name: string;
  description: string | null;
  traffic_limit_gb: number;
  device_limit: number;
  tier_level: number;
  periods: LandingTariffPeriod[];
}

export interface LandingPaymentMethod {
  method_id: string;
  display_name: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
}

export interface LandingConfig {
  slug: string;
  title: string;
  subtitle: string | null;
  features: LandingFeature[];
  footer_text: string | null;
  tariffs: LandingTariff[];
  payment_methods: LandingPaymentMethod[];
  gift_enabled: boolean;
  custom_css: string | null;
  meta_title: string | null;
  meta_description: string | null;
}

export interface PurchaseRequest {
  tariff_id: number;
  period_days: number;
  contact_type: 'email' | 'telegram';
  contact_value: string;
  payment_method: string;
  is_gift: boolean;
  gift_recipient_type?: 'email' | 'telegram';
  gift_recipient_value?: string;
  gift_message?: string;
}

export interface PurchaseResponse {
  purchase_token: string;
  payment_url: string;
}

export interface PurchaseStatus {
  status: 'pending' | 'paid' | 'delivered' | 'failed' | 'expired';
  subscription_url: string | null;
  subscription_crypto_link: string | null;
  is_gift: boolean;
  contact_value: string | null;
  period_days: number | null;
  tariff_name: string | null;
}

// ============================================================
// Locale helpers
// ============================================================

/** Locale dict for multi-language text fields (admin API) */
export type LocaleDict = Record<string, string>;

/** Supported locales for the admin editor */
export const SUPPORTED_LOCALES = ['ru', 'en', 'zh', 'fa'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_META: Record<SupportedLocale, { flag: string; name: string; rtl: boolean }> = {
  ru: { flag: '\u{1F1F7}\u{1F1FA}', name: 'RU', rtl: false },
  en: { flag: '\u{1F1EC}\u{1F1E7}', name: 'EN', rtl: false },
  zh: { flag: '\u{1F1E8}\u{1F1F3}', name: 'ZH', rtl: false },
  fa: { flag: '\u{1F1EE}\u{1F1F7}', name: 'FA', rtl: true },
};

// ============================================================
// Admin types
// ============================================================

/** Admin feature type with localized title/description */
export interface AdminLandingFeature {
  icon: string;
  title: LocaleDict;
  description: LocaleDict;
}

export interface LandingListItem {
  id: number;
  slug: string;
  title: LocaleDict;
  is_active: boolean;
  display_order: number;
  gift_enabled: boolean;
  tariff_count: number;
  method_count: number;
  purchase_stats: {
    total: number;
    paid: number;
    pending: number;
    failed: number;
  };
  created_at: string | null;
  updated_at: string | null;
}

export interface LandingDetail {
  id: number;
  slug: string;
  title: LocaleDict;
  subtitle: LocaleDict | null;
  is_active: boolean;
  features: AdminLandingFeature[];
  footer_text: LocaleDict | null;
  allowed_tariff_ids: number[];
  allowed_periods: Record<string, number[]>;
  payment_methods: LandingPaymentMethod[];
  gift_enabled: boolean;
  custom_css: string | null;
  meta_title: LocaleDict | null;
  meta_description: LocaleDict | null;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface LandingCreateRequest {
  slug: string;
  title: LocaleDict;
  subtitle?: LocaleDict;
  is_active?: boolean;
  features?: AdminLandingFeature[];
  footer_text?: LocaleDict;
  allowed_tariff_ids?: number[];
  allowed_periods?: Record<string, number[]>;
  payment_methods?: LandingPaymentMethod[];
  gift_enabled?: boolean;
  custom_css?: string;
  meta_title?: LocaleDict;
  meta_description?: LocaleDict;
}

export type LandingUpdateRequest = Partial<LandingCreateRequest>;

/**
 * Normalize a value that might be a plain string (old API) or a LocaleDict.
 * If it's a string, wraps it as `{ ru: value }`.
 * If null/undefined, returns the fallback.
 */
/** Extract best display string from a LocaleDict: ru → en → first available → '' */
export function resolveLocaleDisplay(dict: LocaleDict | string | null | undefined): string {
  if (!dict) return '';
  if (typeof dict === 'string') return dict;
  return dict.ru || dict.en || Object.values(dict).find((v) => v?.trim()) || '';
}

export function toLocaleDict(
  value: string | LocaleDict | null | undefined,
  fallback: LocaleDict = {},
): LocaleDict {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value ? { ru: value } : fallback;
  return value;
}

// ============================================================
// Public API
// ============================================================

export const landingApi = {
  getConfig: async (slug: string, lang?: string): Promise<LandingConfig> => {
    const params = lang ? `?lang=${lang}` : '';
    const response = await apiClient.get(`/cabinet/landing/${slug}${params}`);
    return response.data;
  },

  createPurchase: async (slug: string, data: PurchaseRequest): Promise<PurchaseResponse> => {
    const response = await apiClient.post(`/cabinet/landing/${slug}/purchase`, data);
    return response.data;
  },

  getPurchaseStatus: async (token: string): Promise<PurchaseStatus> => {
    const response = await apiClient.get(`/cabinet/landing/purchase/${token}`);
    return response.data;
  },
};

// ============================================================
// Admin API
// ============================================================

export const adminLandingsApi = {
  list: async (): Promise<LandingListItem[]> => {
    const response = await apiClient.get('/cabinet/admin/landings');
    return response.data;
  },

  get: async (id: number): Promise<LandingDetail> => {
    const response = await apiClient.get(`/cabinet/admin/landings/${id}`);
    return response.data;
  },

  create: async (data: LandingCreateRequest): Promise<LandingDetail> => {
    const response = await apiClient.post('/cabinet/admin/landings', data);
    return response.data;
  },

  update: async (id: number, data: LandingUpdateRequest): Promise<LandingDetail> => {
    const response = await apiClient.put(`/cabinet/admin/landings/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/cabinet/admin/landings/${id}`);
    return response.data;
  },

  toggle: async (id: number): Promise<{ id: number; is_active: boolean; message: string }> => {
    const response = await apiClient.post(`/cabinet/admin/landings/${id}/toggle`);
    return response.data;
  },

  reorder: async (landingIds: number[]): Promise<void> => {
    await apiClient.put('/cabinet/admin/landings/order', { landing_ids: landingIds });
  },
};
