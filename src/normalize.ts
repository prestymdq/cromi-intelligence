export function normalizeText(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCode(value: string): string {
  const compact = normalizeText(value).replace(/\s*-\s*/g, " ").toUpperCase();
  const match = compact.match(/^([A-Z]{1,10})\s+(\d{1,10})$/);
  return match ? match[1] + " " + String(Number(match[2])) : compact;
}
