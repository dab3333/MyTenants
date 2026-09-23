export function formatDate(date: Date | string): string {
  const iso = typeof date === "string" ? date : date.toISOString();
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${month}-${day}-${year}`;
}
