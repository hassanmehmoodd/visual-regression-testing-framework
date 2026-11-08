export class VrtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VrtError';
  }
}
