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
import { use } from "react";

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


