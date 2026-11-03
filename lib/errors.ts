export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function publicErrorMessage(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  return "The check stopped unexpectedly. Try again in a moment.";
}
