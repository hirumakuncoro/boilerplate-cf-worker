import { HTTPException } from 'hono/http-exception'

export class NotFoundError extends HTTPException {
  constructor(message = 'Resource not found') {
    super(404, { message })
  }
}

export class BadRequestError extends HTTPException {
  constructor(message = 'Bad request') {
    super(400, { message })
  }
}

export class UnauthorizedError extends HTTPException {
  constructor(message = 'Unauthorized') {
    super(401, { message })
  }
}

export class ForbiddenError extends HTTPException {
  constructor(message = 'Forbidden') {
    super(403, { message })
  }
}

export class TooManyRequestsError extends HTTPException {
  constructor(message = 'Too many requests') {
    super(429, { message })
  }
}
