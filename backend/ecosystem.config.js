module.exports = {
  apps: [
    {
      name: "ai-backend",
      script: "./dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      error_file: "./logs/pm2-err.log",
      out_file: "./logs/pm2-out.log",
      time: true,
      // Важно: чтобы cron работал
      cron_restart: undefined,
      merge_logs: true,
    },
  ],
};
