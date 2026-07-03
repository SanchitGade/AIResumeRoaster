import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req, res) =>
    req.user?._id?.toString() || ipKeyGenerator(req, res),
  message: {
    error: { message: "Too many analyses - Wait for a minute and retry." },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  message: {
    error: { message: "Too manu auth attempts - Please wait and retry." },
  },
});

export { analyzeLimiter, authLimiter };
