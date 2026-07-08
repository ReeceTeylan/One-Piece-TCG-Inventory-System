import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const peso = (n: number | string | null | undefined) =>
  '₱' + Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const pesoF = (n: number | string | null | undefined) =>
  '₱' + Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
