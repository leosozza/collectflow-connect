import { z } from "zod";

export const clientSchema = z.object({
  credor: z.string().trim().min(1, "Credor é obrigatório").max(100, "Credor muito longo"),
  nome_completo: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(200, "Nome muito longo"),
  cpf: z
    .string()
    .trim()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido (formato: 000.000.000-00)"),
  numero_parcela: z.number().int("Parcela deve ser inteiro").min(1, "Parcela mínima é 1").max(9999, "Parcela máxima é 9999"),
  total_parcelas: z.number().int("Total de parcelas deve ser inteiro").min(1, "Mínimo 1 parcela").max(9999, "Máximo 9999 parcelas").optional(),
  valor_entrada: z.number().min(0, "Valor não pode ser negativo").max(99999999.99, "Valor muito alto").optional(),
  valor_parcela: z.number().min(0, "Valor não pode ser negativo").max(99999999.99, "Valor muito alto"),
  valor_pago: z.number().min(0, "Valor não pode ser negativo").max(99999999.99, "Valor muito alto"),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (formato: YYYY-MM-DD)"),
  status: z.enum(["pendente", "pago", "quebrado"], { message: "Status inválido" }),
});

export type ValidatedClientData = z.infer<typeof clientSchema>;

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
