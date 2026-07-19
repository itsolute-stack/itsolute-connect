import type { Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 does not forward rejections from async handlers to the error
// middleware — an unhandled rejection would crash the process and leave the
// request hanging. Wrap every async handler so DB/transient errors become a
// clean 500 (Plivo then retries the webhook).
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
