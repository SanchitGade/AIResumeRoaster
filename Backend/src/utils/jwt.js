import jwt from 'jsonwebtoken';
import env from '../config/env.js';

function signToken(payload) {
    return jwt.sign(payload, env.jwtSecret, {expiresIn: env.jwtExpiresIn})
}

function verifyToken(token) {
    return jwt.verify(token, env.jwtSecret);
}

const cookieOptions = {
    httpsOnly: true,
    secure: env.isPro,
    sameSite: env.isPro ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60* 1000,
    path: '/',
}

export {signToken, verifyToken, cookieOptions};