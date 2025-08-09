export function emailToUsername(email?: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  return `@${local}`;
}
