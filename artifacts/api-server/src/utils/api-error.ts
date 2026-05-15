export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, code?: string, details?: unknown) {
    return new ApiError(400, message, code ?? "BAD_REQUEST", details);
  }

  static notFound(message = "Recurso não encontrado") {
    return new ApiError(404, message, "NOT_FOUND");
  }

  static conflict(message: string) {
    return new ApiError(409, message, "CONFLICT");
  }

  static storage(message = "Erro de armazenamento externo") {
    return new ApiError(502, message, "STORAGE_ERROR");
  }

  static internal(message = "Erro interno do servidor") {
    return new ApiError(500, message, "INTERNAL_ERROR");
  }
}
