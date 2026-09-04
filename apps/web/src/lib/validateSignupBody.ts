const REQUIRED_FIELDS = ["organizationName", "ownerName", "email", "password"] as const;

export function validateSignupBody(
  body: Record<string, unknown>
): string | null {
  for (const field of REQUIRED_FIELDS) {
    const value = body[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      return `${field} is required`;
    }
  }
  return null;
}
