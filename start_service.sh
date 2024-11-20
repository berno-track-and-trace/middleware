#!/bin/bash

# Path to your first program executable
FIRST_PROGRAM_PATH="/path/to/first_program"

# Path to your Node.js app
NODE_APP_PATH="/path/to/your-nodejs-app.js"

# Wait for the first program to start
echo "Waiting for the first program to start..."
while ! pgrep -f "$FIRST_PROGRAM_PATH" > /dev/null; do
  sleep 1
done

echo "First program started. Starting Node.js application..."
pm2 start "$NODE_APP_PATH"
