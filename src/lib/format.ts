export function formatYen(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

export function nowYear(): number {
  return new Date().getFullYear();
}

export function monthOptions(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1);
}
