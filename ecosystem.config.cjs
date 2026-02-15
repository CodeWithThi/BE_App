module.exports = {
    apps: [
        {
            name: 'task-management-api',
            script: 'server.js',
            node_args: '--import=extensionless/register',
            instances: 'max',         // Use all CPU cores
            exec_mode: 'cluster',     // Cluster mode for load balancing
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'development',
                PORT: 3069
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 3069
            },

            // Logging
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/error.log',
            out_file: './logs/app.log',
            merge_logs: true,
            log_type: 'json',

            // Restart policy
            max_restarts: 10,
            min_uptime: '10s',
            restart_delay: 5000,
            autorestart: true,

            // Watch (only for dev, disable in prod)
            watch: false,
            ignore_watch: ['node_modules', 'logs', 'public/avatars']
        }
    ]
};
