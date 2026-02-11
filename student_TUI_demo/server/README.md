# Student TUI SSH Proxy Server

WebSocket-to-SSH proxy server that allows students to access real Linux VMs from their browser.

## Architecture

```
Browser (xterm.js) 
    ↕ WebSocket
Backend Server (this)
    ↕ SSH
Linode VMs
```

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Generate SSH Key Pair

Generate an SSH key pair on your hosting server (Hostinger/DigitalOcean):

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/student_vms -N ""
```

This creates:
- `~/.ssh/student_vms` (private key - stays on server)
- `~/.ssh/student_vms.pub` (public key - add to VMs)

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Update:
- `SSH_PRIVATE_KEY_PATH` - Path to your private key

### 4. Update VM Configuration

Edit `vmConfig.js` and replace placeholder IPs with actual Linode VM IPs:

```javascript
vm1: {
  host: '192.168.1.101',  // Replace with actual IP
  // ...
}
```

### 5. Test Connection

Test SSH manually first:

```bash
ssh -i ~/.ssh/student_vms student@LINODE_VM_IP
```

If this works, the proxy will work.

### 6. Start Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

**With PM2:**
```bash
pm2 start index.js --name student-ssh-proxy
pm2 save
```

## API Endpoints

### Health Check
```
GET /health
```

Returns server status and VM configuration validation.

### Info
```
GET /info
```

Returns server information.

### Active Connections
```
GET /connections
```

Returns list of active SSH sessions.

### WebSocket Terminal
```
WS /ws/terminal?vm=vm1
```

Connects to specified VM via SSH.

## WebSocket Protocol

### Client → Server

**Terminal Input:**
```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

**Terminal Resize:**
```json
{
  "type": "resize",
  "rows": 24,
  "cols": 80
}
```

### Server → Client

**Connection Status:**
```json
{
  "type": "connected",
  "vm": "vm1",
  "sessionId": "sess-123"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Connection failed"
}
```

**Terminal Output:**
Raw bytes from SSH session

## Deployment

### Hostinger

1. Upload server files to Hostinger
2. Install Node.js 18+ on Hostinger
3. Install dependencies: `npm install`
4. Configure `.env` with SSH key path
5. Start with PM2: `pm2 start index.js --name student-ssh-proxy`
6. Configure nginx/Apache to proxy WebSocket connections

### NGINX Configuration

Add to your nginx config:

```nginx
location /ws/terminal {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 7200s;
    proxy_send_timeout 7200s;
}
```

## Troubleshooting

### Connection Refused

**Problem:** Cannot connect to VM

**Solutions:**
- Check VM is running on Linode
- Verify VM IP in `vmConfig.js`
- Test SSH manually: `ssh -i ~/.ssh/student_vms student@VM_IP`
- Check firewall rules on VM (allow port 22)

### Authentication Failed

**Problem:** SSH authentication fails

**Solutions:**
- Verify public key is in `/home/student/.ssh/authorized_keys` on VM
- Check private key path in `.env`
- Verify key permissions: `chmod 600 ~/.ssh/student_vms`

### WebSocket Connection Failed

**Problem:** Browser can't connect to WebSocket

**Solutions:**
- Check server is running: `curl http://localhost:3001/health`
- Verify nginx/Apache WebSocket proxy configuration
- Check browser console for WebSocket errors
- Ensure firewall allows connections to port 3001

### Slow Terminal

**Problem:** Terminal is laggy

**Solutions:**
- Check server CPU/RAM usage
- Check network latency between server and Linode
- Reduce number of concurrent connections
- Upgrade server resources

## Monitoring

### View Logs

**With PM2:**
```bash
pm2 logs student-ssh-proxy
```

**Direct:**
```bash
node index.js
```

### Check Active Connections

```bash
curl http://localhost:3001/connections
```

### Health Check

```bash
curl http://localhost:3001/health
```

## Security Notes

- **SSH Keys:** Never commit private keys to git
- **Environment Variables:** Keep `.env` secure
- **Host Key Verification:** Currently disabled for test environments
- **Network:** Ensure VMs only accept SSH from your server IP
- **Timeout:** Sessions automatically close on disconnect

## Development

### Test Locally

1. Start backend: `npm run dev`
2. Start frontend: `cd .. && npm run dev`
3. Open browser to `http://localhost:5173`
4. Type: `mode vm`
5. Type: `connect vm1`

### Debug Mode

Set environment variable:
```bash
DEBUG=* node index.js
```

## Production Checklist

- [ ] SSH keys generated and deployed to all VMs
- [ ] VM IPs updated in `vmConfig.js`
- [ ] `.env` configured
- [ ] Test SSH connection manually
- [ ] Server started with PM2
- [ ] Nginx/Apache WebSocket proxy configured
- [ ] SSL/TLS certificates installed
- [ ] Firewall configured
- [ ] Monitoring set up
- [ ] Test end-to-end from browser
