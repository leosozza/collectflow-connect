/**
 * Validates whether a document can be generated based on business rules.
 */

export interface ValidationResult {
  isValid: boolean;
  reason: string;
  status: "available" | "unavailable" | "missing_data";
}

export function validateDocumentGeneration(
  docType: string,
  agreement: any | null,
  totalAberto: number,
  totalPago: number
): ValidationResult {
  switch (docType) {
    case "acordo": {
      if (!agreement) {
        return { isValid: false, reason: "Sem acordo disponível", status: "unavailable" };
      }
      const status = agreement.status?.toLowerCase();
      if (status === "cancelado" || status === "cancelled") {
        return { isValid: false, reason: "Acordo cancelado", status: "unavailable" };
      }
      return { isValid: true, reason: "Documento disponível para geração", status: "available" };
    }

    case "recibo": {
      if (totalPago <= 0) {
        return { isValid: false, reason: "Nenhum pagamento encontrado", status: "unavailable" };
      }
      return { isValid: true, reason: "Documento disponível para geração", status: "available" };
    }

    case "quitacao": {
      const agreementPaid = agreement?.status?.toLowerCase() === "pago";
      if (totalAberto > 0 && !agreementPaid) {
        return { isValid: false, reason: "Saldo ainda em aberto", status: "unavailable" };
      }
      return { isValid: true, reason: "Documento disponível para geração", status: "available" };
    }

    case "divida": {
      if (totalAberto <= 0) {
        return { isValid: false, reason: "Sem débito em aberto", status: "unavailable" };
      }
      return { isValid: true, reason: "Documento disponível para geração", status: "available" };
    }

    case "notificacao": {
      if (totalAberto <= 0) {
        return { isValid: false, reason: "Sem débito ativo", status: "unavailable" };
      }
      return { isValid: true, reason: "Documento disponível para geração", status: "available" };
    }

    default:
      return { isValid: true, reason: "Documento disponível", status: "available" };
  }
}
