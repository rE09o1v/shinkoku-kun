export function isPositiveIntegerYen(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

export function normalizeYearInput(value: string): number | null {
  const n = Number(value.trim());
  if (!Number.isInteger(n)) {
    return null;
  }
  if (n >= 2000 && n <= 2100) {
    return n;
  }
  if (n >= 0 && n <= 99) {
    return 2000 + n;
  }
  return null;
}

export function normalizeMonthInput(value: string): number | null {
  const n = Number(value.trim());
  if (!Number.isInteger(n)) {
    return null;
  }
  return n >= 1 && n <= 12 ? n : null;
}
