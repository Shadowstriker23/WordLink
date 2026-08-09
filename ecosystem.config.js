module.exports = {
  apps: [
    {
      name: "wordlink",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      node_args: "--max-old-space-size=256",
      instances: 1,
      autorestart: true,
      max_memory_restart: "384M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
