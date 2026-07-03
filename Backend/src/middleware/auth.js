import ApiError from '../utils/ApiError.js';
import {verifyToken} from '../utils/jwt.js';
import env from '../config/env.js';
import User from '../models/User.js';

async function requiredAuth(req, res, next) {
    try {
        const token = req.cookies?.[env.cookiesName];
        if(!token) throw ApiError.unauthorized();

        const payload = verifyToken(token);
        const user = await User.findById(payload.sub);   //sub = subject, whcih stores userid 
        if(!user) throw ApiError.unauthorized("Session no longer valid");

        req.user = user;
        next();

    } catch (error) {
        if(error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return next(ApiError.unauthorized("Invalid or Expired Session"));
        }
        next(error);
    }
}

export default requiredAuth;