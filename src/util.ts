export function formatTurnover(amount: number): string {
  const arba = 1000000000; // 1 Arba = 100 Crore = 1 Billion
  const crore = 10000000; // 1 Crore = 10 Million

  if (amount >= arba) {
    const arbaValue = Math.floor((amount / arba) * 10) / 10;
    return `${arbaValue.toFixed(1)} Arba`;
  }
  const croreValue = Math.floor(amount / crore);
  return `${croreValue} Crore`;
}

export function formatNumber(value: number | null | undefined): string {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    return "0";
  }

  const num = value;
  let result: string;

  if (Number.isInteger(num)) {
    result = num.toString();
  } else {
    result = num.toFixed(2);
  }

  return result;
}
