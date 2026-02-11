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

export const formatDate = (date: string): string => {
  return new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
};

export const statusColors: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  pago: "bg-success/10 text-success border-success/30",
  quebrado: "bg-destructive/10 text-destructive border-destructive/30",
};

export const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  quebrado: "Quebrado",
};

export const formatPhone = (value: string): string => {
  const nums = value.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
};
