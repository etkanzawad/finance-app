/** Format cents as dollars with 2 decimal places */
export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(dollars);
}

/** Format cents as plain number string */
export function formatMoneyPlain(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Convert dollars to cents (integer) */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert cents to dollars */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Format a date string for display */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format a date string as short (e.g., "15 Feb") */
export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

/** Get colour class for safe-to-spend amount */
export function getSafeToSpendColor(cents: number): string {
  if (cents > 50000) return "text-green-500"; // > $500
  if (cents > 20000) return "text-amber-500"; // > $200
  return "text-red-500";
}
