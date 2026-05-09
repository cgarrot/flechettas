export const MIN_SHARED_SESSION_CODE_LENGTH = 4;
export const MAX_SHARED_SESSION_CODE_LENGTH = 12;

export function normalizeSharedSessionCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function isValidSharedSessionCode(code: string): boolean {
  return code.length >= MIN_SHARED_SESSION_CODE_LENGTH &&
    code.length <= MAX_SHARED_SESSION_CODE_LENGTH &&
    /^[0-9A-Z]+$/.test(code);
}
