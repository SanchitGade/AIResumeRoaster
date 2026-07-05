import jwt from 'jsonwebtoken';
import env from '../config/env.js';

function signToken(payload) {
    console.log(env.expiry);
    return jwt.sign(payload, env.jwtSecret, {expiresIn: env.expiry})
}

function verifyToken(token) {
    return jwt.verify(token, env.jwtSecret);
}

const cookieOptions = {
    httpOnly: true,
    secure: env.isPro,
    sameSite: env.isPro ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60* 1000,
    path: '/',
}

export {signToken, verifyToken, cookieOptions};