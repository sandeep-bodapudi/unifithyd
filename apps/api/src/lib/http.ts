import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { z } from 'zod'

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code)
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST') => new HttpError(400, code, message)
export const notFound = (what = 'Not found') => new HttpError(404, 'NOT_FOUND', what)
export const forbidden = (message = 'You do not have access to this') => new HttpError(403, 'FORBIDDEN', message)
export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, code, message)

/** Wraps an async handler so thrown errors reach the error middleware */
export const h =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

/** Parses input with a zod schema or throws a 400 with field messages */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input)
  if (!r.success) {
    const first = r.error.issues[0]
    throw new HttpError(400, 'INVALID_INPUT', first ? first.message : 'Invalid input', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
  }
  return r.data
}
