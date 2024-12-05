export function formatTurnover(amount: number): string {
  const arba = 1000000000; // 1 Arba = 100 Crore = 1 Billion
  const crore = 10000000; // 1 Crore = 10 Million

  if (amount >= arba) {
    const arbaValue = Math.floor((amount / arba) * 10) / 10; // Ensure proper decimal rounding
    return `${arbaValue.toFixed(1)} Arba`;
  }
  const croreValue = Math.floor(amount / crore);
  return `${croreValue} Crore`;
}
