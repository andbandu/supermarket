/**
 * Universal Currency Formatter for Minimart POS
 * Ensures a consistent space between the currency symbol/code and the amount
 * Example: formatCurrency(10.8, 'LKR') => "LKR 10.80"
 * Example: formatCurrency(2500, 'Rs.') => "Rs. 2500.00"
 */

export function formatCurrency(
  amount: number | string | undefined | null,
  symbol: string = 'LKR'
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? 0));
  const safeNum = isNaN(num) ? 0 : num;
  const cleanSymbol = (symbol || 'LKR').trim();

  // Return formatted price with guaranteed space
  return `${cleanSymbol} ${safeNum.toFixed(2)}`;
}

export function formatPriceWithoutDecimals(
  amount: number | string | undefined | null,
  symbol: string = 'LKR'
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? 0));
  const safeNum = isNaN(num) ? 0 : Math.round(num);
  const cleanSymbol = (symbol || 'LKR').trim();

  return `${cleanSymbol} ${safeNum}`;
}

