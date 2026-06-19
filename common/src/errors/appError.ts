export class AppError extends Error {
  readonly statusCode: number;
  constructor({ statusCode, message }: { statusCode: number; message: string }) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super({ statusCode: 404, message });
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad Request") {
    super({ statusCode: 400, message });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super({ statusCode: 401, message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super({ statusCode: 403, message });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super({ statusCode: 409, message });
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error") {
    super({ statusCode: 500, message });
  }
}
