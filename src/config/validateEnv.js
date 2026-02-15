/**
 * Environment Variable Validation
 * Fail fast on startup if critical variables are missing
 */
const requiredVars = [
    'DATABASE_URL',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
];

const warnings = [
    { key: 'CORS_ORIGIN', message: 'CORS_ORIGIN not set — defaulting to localhost origins' },
    { key: 'SMTP_USER', message: 'SMTP_USER not set — email features will not work' },
];

export function validateEnv() {
    const missing = requiredVars.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ [ENV ERROR] Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('Please check your .env file.');
        process.exit(1);
    }

    // Warn about weak secrets
    if (process.env.ACCESS_TOKEN_SECRET && process.env.ACCESS_TOKEN_SECRET.length < 32) {
        console.warn('⚠️ [SECURITY] ACCESS_TOKEN_SECRET is too short (< 32 chars). Generate a stronger secret.');
    }
    if (process.env.REFRESH_TOKEN_SECRET && process.env.REFRESH_TOKEN_SECRET.length < 32) {
        console.warn('⚠️ [SECURITY] REFRESH_TOKEN_SECRET is too short (< 32 chars). Generate a stronger secret.');
    }

    // Check weak default passwords in DATABASE_URL
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes(':1234@')) {
        console.warn('⚠️ [SECURITY] Database password appears to be default (1234). Change before deploying to production.');
    }

    // Production-specific checks
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.CORS_ORIGIN) {
            console.error('❌ [ENV ERROR] CORS_ORIGIN is required in production mode.');
            process.exit(1);
        }
    }

    // Non-critical warnings
    warnings.forEach(({ key, message }) => {
        if (!process.env[key]) {
            console.warn(`⚠️ [ENV] ${message}`);
        }
    });

    console.log('✅ Environment variables validated');
}
