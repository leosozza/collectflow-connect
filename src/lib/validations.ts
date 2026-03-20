import { z } from "zod";

// ─── Client Schema ───────────────────────────────────────────────────────────

export const clientSchema = z.object({
  credor: z.string().trim().min(1, "Credor é obrigatório").max(100, "Credor muito longo"),
  nome_completo: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(200, "Nome muito longo"),
  cpf: z
    .string()
    .trim()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido (formato: 000.000.000-00)"),
  numero_parcela: z.number().int("Parcela deve ser inteiro").min(1, "Parcela mínima é 1").max(9999, "Parcela máxima é 9999").optional().default(1),
  total_parcelas: z.number().int("Total de parcelas deve ser inteiro").min(1, "Mínimo 1 parcela").max(9999, "Máximo 9999 parcelas").optional(),
  valor_entrada: z.number().min(0, "Valor não pode ser negativo").max(99999999.99, "Valor muito alto").optional().default(0),
  valor_parcela: z.number().min(0, "Valor não pode ser negativo").max(99999999.99, "Valor muito alto").optional().default(0),
  valor_pago: z.number().min(0, "Valor não pode ser negativo").max(99999999.99, "Valor muito alto").optional().default(0),
  data_vencimento: z.string().transform(v => v === "" ? null : v).pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (formato: YYYY-MM-DD)").nullable()).optional().nullable(),
  status: z.enum(["pendente", "pago", "quebrado"], { message: "Status inválido" }).optional().default("pendente"),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email("Email inválido").max(255).optional().nullable(),
  external_id: z.string().trim().max(100).optional().nullable(),
  endereco: z.string().trim().max(300).optional().nullable(),
  cidade: z.string().trim().max(100).optional().nullable(),
  uf: z.string().trim().max(2).optional().nullable(),
  cep: z.string().trim().max(10).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export type ValidatedClientData = z.infer<typeof clientSchema>;

// ─── Agreement Schema ────────────────────────────────────────────────────────

export const agreementSchema = z.object({
  client_cpf: z.string().trim().min(1, "CPF é obrigatório"),
  client_name: z.string().trim().min(2, "Nome é obrigatório").max(200),
  credor: z.string().trim().min(1, "Credor é obrigatório").max(100),
  original_total: z.number().min(0, "Valor original não pode ser negativo"),
  proposed_total: z.number().min(0, "Valor proposto não pode ser negativo"),
  discount_percent: z.number().min(0).max(100, "Desconto máximo é 100%"),
  new_installments: z.number().int().min(1, "Mínimo 1 parcela").max(999),
  new_installment_value: z.number().min(0),
  first_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  entrada_value: z.number().min(0).optional(),
  entrada_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type ValidatedAgreementData = z.infer<typeof agreementSchema>;

// ─── CRM Lead Schema ────────────────────────────────────────────────────────

export const crmLeadSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório").max(200),
  email: z.string().trim().email("Email inválido").max(255).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  status: z.string().trim().max(50).optional().default("novo"),
  source: z.string().trim().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type ValidatedCRMLeadData = z.infer<typeof crmLeadSchema>;

// ─── Workflow Schema ─────────────────────────────────────────────────────────

export const workflowSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(1000).optional().default(""),
  trigger_type: z.string().min(1, "Tipo de gatilho é obrigatório"),
  is_active: z.boolean().optional().default(false),
  nodes: z.array(z.any()).optional().default([]),
  edges: z.array(z.any()).optional().default([]),
});

export type ValidatedWorkflowData = z.infer<typeof workflowSchema>;

// ─── Expense Schema ──────────────────────────────────────────────────────────

export const expenseSchema = z.object({
  description: z.string().trim().min(1, "Descrição é obrigatória").max(300),
  amount: z.number().min(0.01, "Valor deve ser maior que zero").max(99999999.99),
  category: z.string().trim().min(1, "Categoria é obrigatória").max(100),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

export type ValidatedExpenseData = z.infer<typeof expenseSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Validates client data and throws a descriptive error if invalid */
export const validateClientData = (data: unknown): ValidatedClientData => {
  return clientSchema.parse(data);
};

/** Validates an array of client rows for bulk import, returns valid rows and errors */
export const validateImportRows = (
  rows: unknown[]
): { valid: ValidatedClientData[]; errors: Array<{ index: number; message: string }> } => {
  const valid: ValidatedClientData[] = [];
  const errors: Array<{ index: number; message: string }> = [];

  rows.forEach((row, index) => {
    const result = clientSchema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      const message = result.error.issues.map((i) => i.message).join("; ");
      errors.push({ index: index + 1, message });
    }
  });

  return { valid, errors };
};
