import express from "express";
import { email, z } from "zod";
import env from "../config/env.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { signToken, cookieOptions } from "../utils/jwt.js";
import validate from "../middleware/validate.js";
import requiredAuth from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import User from "../models/User.js";

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

//Helpe Function - To set the userId as subject in token (will call form /register & /login)
function issueSession(res, user) {
  const token = signToken({ sub: user._id.toString() });
  res.cookie(env.cookieName, token, cookieOptions);
}

router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) throw ApiError.conflict("Email already registered");

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email, passwordHash });

    issueSession(res, user);
    res.status(201).json({ user });
  }),
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) throw ApiError.unauthorized("Invalid credentials");

    const ok = await user.comparePassword(password);
    if (!ok) throw ApiError.unauthorized("Invalid credentials");

    issueSession(res, user);
    res.json({ user });
  }),
);

router.post("/logout", (req, res) => {
  res.clearCookie(env.cookieName, { ...cookieOptions, maxAge: 0 });
  res.json({ ok: true });
});

router.get(
  "/me",
  requiredAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

router.patch(
  "/profile",
  requiredAuth,
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    req.user.name = req.body.name;
    await req.user.save();
    res.json({ user: req.user });
  }),
);

router.patch(
  "/password",
  authLimiter,
  requiredAuth,
  validate(passwordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!user) throw ApiError.unauthorized("Session no longer valid");

    const ok = await user.comparePassword(req.body.currentPassword);
    if (!ok) throw ApiError.unauthorized("Current password is incorrect");

    user.passwordHash = await User.hashPassword(req.body.newPassword);
    await user.save();
    res.json({ ok: true });
  }),
);

export default router;
