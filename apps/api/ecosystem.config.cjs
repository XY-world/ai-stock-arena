module.exports = {
  apps: [{
    name: 'arena-api',
    script: 'dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '300M',
    watch: false
  }]
};
