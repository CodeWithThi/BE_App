import rateLimit from 'express-rate-limit';

// General API rate limiter — 100 requests per minute per IP
export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 1 phút.'
    }
});

// Strict limiter for auth routes — 10 requests per minute per IP
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau 1 phút.'
    }
});
