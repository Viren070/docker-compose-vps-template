const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    console.error(`Health check failed with status code: ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.error(`Health check failed: ${err.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check timed out');
  req.destroy();
  process.exit(1);
});

req.end();