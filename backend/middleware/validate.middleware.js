/**
 * Generic Zod validation middleware.
 * Validates req.body against the provided Zod schema.
 *
 * Usage:
 *   const { z } = require('zod');
 *   const schema = z.object({ name: z.string() });
 *   router.post('/path', validate(schema), controller.handler);
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // Replace body with parsed/sanitized data
  req.body = result.data;
  next();
};

module.exports = validate;
