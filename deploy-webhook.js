const http = require('http');
const { exec } = require('child_process');

const PORT = 9999; // Webhook Port
const SECRET_TOKEN = 'virtual_cfo_deploy_secret_2026';

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/deploy') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      console.log('🚀 GitHub Push Event Received! Deploying latest code...');
      
      const commands = `
        cd /var/www/Virtual-CFO && \
        git fetch origin main && \
        git reset --hard origin/main && \
        npm install && \
        npm run build && \
        pm2 restart all
      `;

      exec(commands, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Deploy Error: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
          return;
        }
        console.log(`✅ Deploy Output:\n${stdout}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Deployed successfully!' }));
      });
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`📡 Auto-Deploy Webhook Listener running on port ${PORT}...`);
});
