export const formatCPF = (value: string): string => {
  const nums = value.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const parseCurrencyInput = (value: string): number => {
  const clean = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

export const formatDate = (input: string | Date | null | undefined): string => {
  if (!input) return "—";
  const s = typeof input === "string" ? input.trim() : input.toISOString();
  if (!s) return "—";
  // Aceita "YYYY-MM-DD" puro OU timestamp ISO completo (ou qualquer string parseável).
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00") : new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

export const formatCredorName = (name?: string | null): string => {
  if (!name) return "—";
  return String(name).trim() || "—";
};

export const statusColors: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  pago: "bg-success/10 text-success border-success/30",
  quebrado: "bg-destructive/10 text-destructive border-destructive/30",
};

export const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  vencido: "Vencido",
  pago: "Pago",
  quebrado: "Quebrado",
  em_acordo: "Em Acordo",
};

export const formatCEP = (value: string): string => {
  const nums = value.replace(/\D/g, "").slice(0, 8);
  if (nums.length <= 5) return nums;
  return `${nums.slice(0, 5)}-${nums.slice(5)}`;
};

export const formatPhone = (value: string): string => {
  const nums = value.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
};

export const maskCPF = (cpf: string): string => {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length < 5) return "***";
  return `***.***.${nums.slice(-5, -2)}-${nums.slice(-2)}`;
};

export const maskPhone = (phone: string): string => {
  if (!phone) return "";
  const nums = phone.replace(/\D/g, "");
  if (nums.length < 4) return "****";
  return `(**) ****-${nums.slice(-4)}`;
};

export const maskEmail = (email: string): string => {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.charAt(0)}***@${domain}`;
};
