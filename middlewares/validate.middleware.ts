import { ZodError } from 'zod';
import { createError } from './error.middleware.js';

export const validateRequest = (schema: any) => {
  return async (req: any, res: any, next: any) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const validationError = createError('Validation failed', 400);
        validationError.message = 'Validation failed';
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};