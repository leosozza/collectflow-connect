/**
 * Pure CPF/CNPJ utility functions.
 * Centralizes logic previously duplicated across importService, formatters, etc.
 */

/** Remove all non-digit characters from a CPF/CNPJ string */
export const cleanCPF = (value: any): string => {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "").padStart(11, "0").slice(0, 14);
  if (digits.length !== 11 && digits.length !== 14) return "";
  return digits;
};

/** Format a digit-only CPF (11 digits) or CNPJ (14 digits) for display */
export const formatCPFDisplay = (cpf: string): string => {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length === 11) {
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  }
  if (nums.length === 14) {
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`;
  }
  return cpf;
};

/** Validate CPF checksum (mod-11 algorithm) */
export const isValidCPF = (cpf: string): boolean => {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(nums)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(nums[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(nums[10]);
};

/** Normalize a CPF to digits-only, 11-char padded string */
export const normalizeCPF = (value: string): string => {
  return value.replace(/\D/g, "").padStart(11, "0").slice(0, 11);
};

/** Normalize a phone number to digits-only, removing country code 55 if present */
export const normalizePhone = (value: string): string => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  if (digits.length === 12 && digits.startsWith("55")) return digits.slice(2);
  return digits;
};
