// Same rule as the backend (organization.dto.ts)
export const ORG_NAME = /^[\p{L}0-9 .,'&()\-]{3,100}$/u;

/** Returns an error message, or null when the form is valid. */
export function validateOrgForm(name: string, description: string): string | null {
  if (!ORG_NAME.test(name.trim())) {
    return "Name must be 3-100 characters: letters, numbers and . , ' & ( ) -";
  }
  if (description.trim().length > 500) {
    return 'Description must be 500 characters or fewer';
  }
  return null;
}
