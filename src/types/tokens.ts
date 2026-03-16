// ============================================
// ENUMS
// ============================================
export type ServicePriceType = 'fixed' | 'per_unit' | 'monthly' | 'variable';
export type ServiceCategory = 'crm' | 'contact_center' | 'ai_agent' | 'addon' | 'negativacao' | 'tokens' | 'core' | 'integration' | 'enrichment';
export type ServiceStatus = 'active' | 'suspended' | 'cancelled' | 'pending';
export type TokenTransactionType = 'purchase' | 'consumption' | 'refund' | 'bonus' | 'adjustment' | 'expiration' | 'transfer';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

// ============================================
// SERVICE CATALOG
// ============================================
export interface ServiceCatalogItem {
  id: string;
  service_code: string;
  name: string;
  description: string | null;
  price: number;
  price_type: ServicePriceType;
  unit_label: string | null;
  is_active: boolean;
  category: ServiceCategory;
  tokens_required: number;
  display_order: number;
  icon: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ServiceCatalogCreateInput {
  service_code: string;
  name: string;
  description?: string;
  price: number;
  price_type: ServicePriceType;
  unit_label?: string;
  category: ServiceCategory;
  tokens_required?: number;
  icon?: string;
  metadata?: Record<string, any>;
}

export interface ServiceCatalogUpdateInput {
  name?: string;
  description?: string;
  price?: number;
  price_type?: ServicePriceType;
  unit_label?: string;
  is_active?: boolean;
  category?: ServiceCategory;
  tokens_required?: number;
  display_order?: number;
  icon?: string;
  metadata?: Record<string, any>;
}

// ============================================
// TENANT SERVICES
// ============================================
export interface TenantService {
  id: string;
  tenant_id: string;
  service_id: string;
  status: ServiceStatus;
  quantity: number;
  unit_price_override: number | null;
  activated_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  config: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  service?: ServiceCatalogItem;
}

// ============================================
// TENANT TOKENS
// ============================================
export interface TenantTokens {
  id: string;
  tenant_id: string;
  token_balance: number;
  reserved_balance: number;
  lifetime_purchased: number;
  lifetime_consumed: number;
  low_balance_threshold: number;
  auto_recharge_enabled: boolean;
  auto_recharge_amount: number | null;
  last_purchase_at: string | null;
  last_consumption_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// TOKEN PACKAGES
// ============================================
export interface TokenPackage {
  id: string;
  name: string;
  description: string | null;
  token_amount: number;
  bonus_tokens: number;
  price: number;
  discount_percentage: number;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

// ============================================
// TOKEN TRANSACTIONS
// ============================================
export interface TokenTransaction {
  id: string;
  tenant_id: string;
  amount: number;
  balance_after: number;
  transaction_type: TokenTransactionType;
  service_code: string | null;
  reference_id: string | null;
  reference_type: string | null;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
  created_by: string | null;
}

// ============================================
// PAYMENT RECORDS
// ============================================
export interface PaymentRecord {
  id: string;
  tenant_id: string;
  payment_type: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: string | null;
  payment_gateway: string | null;
  gateway_transaction_id: string | null;
  gateway_response: Record<string, any>;
  token_package_id: string | null;
  tokens_granted: number | null;
  invoice_url: string | null;
  invoice_pdf_url: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ============================================
// SERVICE USAGE LOGS
// ============================================
export interface ServiceUsageLog {
  id: string;
  tenant_id: string;
  service_code: string;
  tokens_consumed: number;
  usage_type: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  status: 'success' | 'failed' | 'partial';
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
  created_by: string | null;
}

// ============================================
// TOKEN SUMMARY (from RPC)
// ============================================
export interface TokenSummary {
  balance: number;
  reserved: number;
  available: number;
  total_purchased: number;
  total_consumed: number;
  last_30_days_consumed: number;
}

// ============================================
// CATEGORY COLORS
// ============================================
export const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  core: '#3B82F6',
  ai_agent: '#8B5CF6',
  integration: '#F97316',
  addon: '#22C55E',
};

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  core: 'Core',
  ai_agent: 'AI Agent',
  integration: 'Integração',
  addon: 'Addon',
};

export const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  purchase: '#22C55E',
  consumption: '#EF4444',
  bonus: '#EAB308',
  refund: '#3B82F6',
  adjustment: '#6B7280',
  expiration: '#F97316',
  transfer: '#8B5CF6',
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  purchase: 'Compra',
  consumption: 'Consumo',
  bonus: 'Bônus',
  refund: 'Reembolso',
  adjustment: 'Ajuste',
  expiration: 'Expiração',
  transfer: 'Transferência',
};
