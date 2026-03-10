import { supabase } from "@/integrations/supabase/client";

const invokeAsaasProxy = async (action: string, payload: Record<string, any> = {}) => {
  const { data, error } = await supabase.functions.invoke("asaas-proxy", {
    body: { action, ...payload },
  });

  if (error) throw error;
  return data;
};

export const createAsaasCustomer = async (customerData: {
  name: string;
  email?: string;
  cpfCnpj: string;
  phone?: string;
}) => {
  return invokeAsaasProxy("create_customer", customerData);
};

export const createAsaasPayment = async (paymentData: {
  customer: string;
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX";
  value: number;
  dueDate: string;
  description?: string;
  creditCard?: Record<string, any>;
  creditCardHolderInfo?: Record<string, any>;
}) => {
  return invokeAsaasProxy("create_payment", paymentData);
};

export const getAsaasPayment = async (paymentId: string) => {
  return invokeAsaasProxy("get_payment", { paymentId });
};

export const getAsaasPixQrCode = async (paymentId: string) => {
  return invokeAsaasProxy("get_pix_qrcode", { paymentId });
};
