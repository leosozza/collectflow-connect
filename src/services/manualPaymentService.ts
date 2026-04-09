import { supabase } from "@/integrations/supabase/client";
import { registerAgreementPayment } from "@/services/agreementService";
import { logAction } from "@/services/auditService";
import { logger } from "@/lib/logger";
import { handleServiceError } from "@/lib/errorHandler";

const MODULE = "manualPaymentService";

export interface ManualPayment {
  id: string;
  tenant_id: string;
  agreement_id: string;
  installment_number: number;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  receiver: string;
  notes: string | null;
  status: string;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface ManualPaymentWithDetails extends ManualPayment {
  agreement?: {
    client_name: string;
    client_cpf: string;
    credor: string;
    new_installments: number;
    entrada_value: number | null;
  };
  requester?: { full_name: string };
  reviewer?: { full_name: string };
}

export interface CreateManualPaymentData {
  agreement_id: string;
  installment_number: number;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  receiver: string;
  notes?: string;
}

export const manualPaymentService = {
  async create(data: CreateManualPaymentData, tenantId: string, profileId: string): Promise<ManualPayment> {
    try {
      const { data: result, error } = await supabase
        .from("manual_payments" as any)
        .insert({
          ...data,
          tenant_id: tenantId,
          requested_by: profileId,
          status: "pending_confirmation",
        })
        .select()
        .single();

      if (error) throw error;
      const payment = result as any as ManualPayment;

      // Register client_event
      try {
        const { data: agr } = await supabase
          .from("agreements")
          .select("client_cpf, credor, tenant_id")
          .eq("id", data.agreement_id)
          .single();

        if (agr) {
          await supabase.from("client_events").insert({
            tenant_id: tenantId,
            client_cpf: (agr as any).client_cpf,
            event_type: "manual_payment_requested",
            event_source: "operator",
            event_value: data.payment_method,
            metadata: {
              manual_payment_id: payment.id,
              agreement_id: data.agreement_id,
              installment_number: data.installment_number,
              amount_paid: data.amount_paid,
              receiver: data.receiver,
              payment_method: data.payment_method,
              requested_by: profileId,
            },
          } as any);
        }
      } catch (e) {
        logger.error(MODULE, "create_event", e);
      }

      logAction({
        action: "manual_payment_request",
        entity_type: "manual_payment",
        entity_id: payment.id,
        details: { agreement_id: data.agreement_id, amount: data.amount_paid, receiver: data.receiver },
      });

      logger.info(MODULE, "create", { id: payment.id });
      return payment;
    } catch (error) {
      handleServiceError(error, MODULE);
    }
  },

  async fetchByAgreement(agreementId: string): Promise<ManualPayment[]> {
    try {
      const { data, error } = await supabase
        .from("manual_payments" as any)
        .select("*")
        .eq("agreement_id", agreementId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any as ManualPayment[]) || [];
    } catch (error) {
      handleServiceError(error, MODULE);
    }
  },

  async fetchPending(tenantId: string): Promise<ManualPaymentWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from("manual_payments" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "pending_confirmation")
        .order("created_at", { ascending: true });

      if (error) throw error;
      const payments = (data as any as ManualPayment[]) || [];

      // Enrich with agreement + profile data
      if (payments.length === 0) return [];

      const agreementIds = [...new Set(payments.map(p => p.agreement_id))];
      const requesterIds = [...new Set(payments.map(p => p.requested_by))];

      const [agResult, profileResult] = await Promise.all([
        supabase.from("agreements").select("id, client_name, client_cpf, credor, new_installments, entrada_value").in("id", agreementIds),
        supabase.from("profiles").select("id, full_name").in("id", requesterIds),
      ]);

      const agMap = new Map((agResult.data || []).map((a: any) => [a.id, a]));
      const profileMap = new Map((profileResult.data || []).map((p: any) => [p.id, p]));

      return payments.map(p => ({
        ...p,
        agreement: agMap.get(p.agreement_id) as any,
        requester: profileMap.get(p.requested_by) as any,
      }));
    } catch (error) {
      handleServiceError(error, MODULE);
    }
  },

  async fetchAll(tenantId: string): Promise<ManualPaymentWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from("manual_payments" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any as ManualPaymentWithDetails[]) || [];
    } catch (error) {
      handleServiceError(error, MODULE);
    }
  },

  async confirm(paymentId: string, reviewerProfileId: string, reviewNotes?: string): Promise<void> {
    try {
      // Fetch payment + agreement
      const { data: payment, error: fetchErr } = await supabase
        .from("manual_payments" as any)
        .select("*")
        .eq("id", paymentId)
        .single();

      if (fetchErr) throw fetchErr;
      const mp = payment as any as ManualPayment;

      if (mp.status !== "pending_confirmation") {
        throw new Error("Pagamento já foi processado");
      }

      // Get agreement info
      const { data: agr } = await supabase
        .from("agreements")
        .select("client_cpf, credor, tenant_id")
        .eq("id", mp.agreement_id)
        .single();

      if (!agr) throw new Error("Acordo não encontrado");

      // Execute real payment via registerAgreementPayment
      await registerAgreementPayment(
        (agr as any).client_cpf,
        (agr as any).credor,
        mp.amount_paid
      );

      // Update manual_payment status
      const { error: updateErr } = await supabase
        .from("manual_payments" as any)
        .update({
          status: "confirmed",
          reviewed_by: reviewerProfileId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq("id", paymentId);

      if (updateErr) throw updateErr;

      // Check if agreement is fully paid and mark as approved
      try {
        const { data: agreement } = await supabase
          .from("agreements")
          .select("id, proposed_total, status")
          .eq("id", mp.agreement_id)
          .single();

        // === PAGAMENTO REAL CONSOLIDADO === Nunca regredir de completed
        if (agreement && agreement.status !== "completed") {
          const { data: confirmedPayments } = await supabase
            .from("manual_payments" as any)
            .select("amount_paid")
            .eq("agreement_id", mp.agreement_id)
            .eq("status", "confirmed");

          const { data: paidCobrancas } = await supabase
            .from("negociarie_cobrancas" as any)
            .select("valor_pago")
            .eq("agreement_id", mp.agreement_id)
            .eq("status", "pago");

          const manualTotal = ((confirmedPayments as any[]) || []).reduce((s, p) => s + Number(p.amount_paid || 0), 0);
          const cobrancaTotal = ((paidCobrancas as any[]) || []).reduce((s, c) => s + Number(c.valor_pago || 0), 0);
          // Canais distintos — soma direta sem dupla contagem
          const totalPaid = manualTotal + cobrancaTotal;

          if (totalPaid >= (agreement.proposed_total || 0) - 0.01 && agreement.proposed_total > 0) {
            // Acordo totalmente quitado → completed (não approved)
            await supabase
              .from("agreements")
              .update({ status: "completed" })
              .eq("id", mp.agreement_id);

            // Also update client status
            await supabase
              .from("clients")
              .update({ status: "pago" })
              .eq("status", "em_acordo")
              .eq("credor", (agr as any).credor)
              .eq("cpf", (agr as any).client_cpf)
              .eq("tenant_id", mp.tenant_id);
          }
        }
      } catch (e) {
        logger.error(MODULE, "check_fully_paid", e);
      }

      // Register event
      try {
        await supabase.from("client_events").insert({
          tenant_id: mp.tenant_id,
          client_cpf: (agr as any).client_cpf,
          event_type: "manual_payment_confirmed",
          event_source: "admin",
          event_value: "confirmed",
          metadata: {
            manual_payment_id: paymentId,
            agreement_id: mp.agreement_id,
            amount_paid: mp.amount_paid,
            receiver: mp.receiver,
            payment_method: mp.payment_method,
            reviewed_by: reviewerProfileId,
          },
        } as any);
      } catch (e) {
        logger.error(MODULE, "confirm_event", e);
      }

      logAction({
        action: "manual_payment_confirm",
        entity_type: "manual_payment",
        entity_id: paymentId,
        details: { agreement_id: mp.agreement_id, amount: mp.amount_paid },
      });

      logger.info(MODULE, "confirm", { id: paymentId });
    } catch (error) {
      handleServiceError(error, MODULE);
    }
  },

  async reject(paymentId: string, reviewerProfileId: string, reviewNotes: string): Promise<void> {
    try {
      const { data: payment, error: fetchErr } = await supabase
        .from("manual_payments" as any)
        .select("*")
        .eq("id", paymentId)
        .single();

      if (fetchErr) throw fetchErr;
      const mp = payment as any as ManualPayment;

      if (mp.status !== "pending_confirmation") {
        throw new Error("Pagamento já foi processado");
      }

      const { error: updateErr } = await supabase
        .from("manual_payments" as any)
        .update({
          status: "rejected",
          reviewed_by: reviewerProfileId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq("id", paymentId);

      if (updateErr) throw updateErr;

      // Register event
      try {
        const { data: agr } = await supabase
          .from("agreements")
          .select("client_cpf")
          .eq("id", mp.agreement_id)
          .single();

        if (agr) {
          await supabase.from("client_events").insert({
            tenant_id: mp.tenant_id,
            client_cpf: (agr as any).client_cpf,
            event_type: "manual_payment_rejected",
            event_source: "admin",
            event_value: "rejected",
            metadata: {
              manual_payment_id: paymentId,
              agreement_id: mp.agreement_id,
              review_notes: reviewNotes,
              reviewed_by: reviewerProfileId,
            },
          } as any);
        }
      } catch (e) {
        logger.error(MODULE, "reject_event", e);
      }

      logAction({
        action: "manual_payment_reject",
        entity_type: "manual_payment",
        entity_id: paymentId,
        details: { agreement_id: mp.agreement_id, review_notes: reviewNotes },
      });

      logger.info(MODULE, "reject", { id: paymentId });
    } catch (error) {
      handleServiceError(error, MODULE);
    }
  },
};
