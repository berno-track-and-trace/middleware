module.exports = {
  apps: [{
    name: 'middleware',
    script: './index.js',
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_restarts: 5,
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    pid_file: './logs/pid.log',
    post_start: "./gpio_control.sh 0",
    post_stop: "./gpio_control.sh 1",
    post_restart: "./gpio_control.sh 0"
  }]
};
