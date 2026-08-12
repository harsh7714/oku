import { validationResult } from 'express-validator';

// Wraps an array of express-validator chains; runs them, then rejects with
// the existing { message } error shape used across the rest of the API.
export const validate = (chains) => [
  ...chains,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    next();
  },
];
