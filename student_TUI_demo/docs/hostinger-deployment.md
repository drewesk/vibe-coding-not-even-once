# Hostinger Deployment Guide

Complete guide for deploying the Student TUI with SSH VM access on Hostinger (DineNYC.io).

## Prerequisites

- Hostinger VPS with SSH access
- Node.js 18+ installed on Hostinger
- Domain: DineNYC.io pointed to Hostinger server
- Linode account with free credits

## Part 1: Prepare Linode VMs

### 1.1 Install Linode CLI (on your local machine)

```bash
pip3 install linode-cli
linode-cli configure
```

### 1.2 Create Golden VM

**Via Linode Dashboard:**
1. Go to Linode Dashboard
2. Click "Create Linode"
3. Choose:
   - Distribution: Ubuntu 22.04 LTS
   - Plan: Nanode 1GB ($5/month)
   - Region: Closest to your Hostinger server
   - Label: student-vm-golden
4. Click "Create Linode"
5. Wait for it to boot (~30 seconds)

### 1.3 Configure Golden VM

```bash
# Get VM IP from Linode dashboard
VM_IP="your-vm-ip"

# Upload setup script
scp scripts/setup-golden-vm.sh root@$VM_IP:/root/

# SSH into VM
ssh root@$VM_IP

# Run setup script
bash /root/setup-golden-vm.sh

# This will take 3-5 minutes
```

### 1.4 Add SSH Public Key to Golden VM

On your **Hostinger server**:

```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/student_vms -N ""

# View public key
cat ~/.ssh/student_vms.pub
# Copy this output
```

Back on the **Linode VM**:

```bash
# Edit authorized_keys
nano /home/student/.ssh/authorized_keys

# Paste your public key, save and exit (Ctrl+X, Y, Enter)
```

### 1.5 Test SSH Connection

From **Hostinger server**:

```bash
ssh -i ~/.ssh/student_vms student@$VM_IP

# You should connect without password
# If connected successfully, type 'exit' to disconnect
```

### 1.6 Create Snapshot

**Via Linode Dashboard:**
1. Go to your student-vm-golden Linode
2. Click "Storage" tab
3. Click "Create Snapshot"
4. Name it: `student-vm-golden-2025-02-11`
5. Wait for snapshot to complete (~5 minutes)

### 1.7 Clone VMs from Snapshot

**Create 4 VMs from snapshot:**

For each VM (vm1, vm2, vm3, vm4):

1. Click "Create Linode"
2. Choose "Create from Backup"
3. Select your golden snapshot
4. Plan: Nanode 1GB
5. Label: student-vm-1 (then vm-2, vm-3, vm-4)
6. Click "Create Linode"

This creates 4 identical VMs ready for students.

### 1.8 Record VM IP Addresses

```bash
# Create a text file with IPs
VM1_IP="..."
VM2_IP="..."
VM3_IP="..."
VM4_IP="..."
```

---

## Part 2: Deploy Backend to Hostinger

### 2.1 Upload Project to Hostinger

From your **local machine**:

```bash
# Compress project
cd /path/to/student_TUI_demo
tar -czf student-tui.tar.gz --exclude=node_modules --exclude=dist .

# Upload to Hostinger
scp student-tui.tar.gz user@dinenyc.io:/home/user/

# SSH into Hostinger
ssh user@dinenyc.io

# Extract
cd /home/user
tar -xzf student-tui.tar.gz
mv student_TUI_demo /var/www/student-tui  # Or your preferred path
cd /var/www/student-tui
```

### 2.2 Install Frontend Dependencies

```bash
npm install
npm run build
```

### 2.3 Install Backend Dependencies

```bash
cd server
npm install
cd ..
```

### 2.4 Configure Backend Environment

```bash
cd server

# Create .env file
cat > .env <<EOF
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
SSH_PRIVATE_KEY_PATH=/home/user/.ssh/student_vms
EOF
```

### 2.5 Update VM IPs in Backend Config

```bash
# Edit vmConfig.js
nano server/vmConfig.js

# Replace LINODE_IP_1, LINODE_IP_2, etc. with actual IPs
# Use the IPs you recorded in step 1.8
```

**Example:**
```javascript
vm1: {
  host: '192.168.1.101',  // Replace with actual IP
  // ...
}
```

### 2.6 Test Backend Manually

```bash
cd server
node index.js

# You should see:
# ✅ Server running on 0.0.0.0:3001
# Check for any warnings about VM configuration
```

Press Ctrl+C to stop.

### 2.7 Install PM2 and Start Backend

```bash
# Install PM2 globally
npm install -g pm2

# Start backend
cd /var/www/student-tui/server
pm2 start index.js --name student-ssh-proxy

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status
pm2 logs student-ssh-proxy
```

---

## Part 3: Configure Web Server

### 3.1 NGINX Configuration

Edit your nginx config for DineNYC.io:

```bash
sudo nano /etc/nginx/sites-available/dinenyc.io
```

Add/update:

```nginx
server {
    server_name dinenyc.io www.dinenyc.io;

    # Frontend - React app
    location / {
        root /var/www/student-tui/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend - WebSocket SSH Proxy
    location /ws/terminal {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        
        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Long timeout for terminal sessions (2 hours)
        proxy_read_timeout 7200s;
        proxy_send_timeout 7200s;
        
        # Buffering
        proxy_buffering off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        proxy_set_header Host $host;
    }

    # SSL configuration (if using Let's Encrypt)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/dinenyc.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dinenyc.io/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name dinenyc.io www.dinenyc.io;
    return 301 https://$server_name$request_uri;
}
```

### 3.2 Test and Reload NGINX

```bash
# Test configuration
sudo nginx -t

# If OK, reload
sudo systemctl reload nginx
```

### 3.3 Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Backend port (only from localhost)
# No need to open 3001 externally - NGINX proxies to it

# Enable firewall
sudo ufw enable
sudo ufw status
```

---

## Part 4: Testing

### 4.1 Test Backend Health

```bash
curl http://localhost:3001/health

# Should return JSON with VM status
```

### 4.2 Test WebSocket Connection

From your **local machine**:

```bash
# Install wscat
npm install -g wscat

# Test WebSocket connection
wscat -c wss://dinenyc.io/ws/terminal?vm=vm1

# You should see connection established
# Press Ctrl+C to disconnect
```

### 4.3 Test Full End-to-End

1. Open browser: `https://dinenyc.io`
2. You should see the Student TUI interface
3. Type: `mode vm`
4. You should see VM selection menu
5. Type: `connect vm1`
6. You should see:
   - "Connecting to VM 1..."
   - "Establishing SSH connection..."
   - "Connected to VM 1"
   - SSH prompt: `student@student-vm-1:~/workspace$`
7. Try commands:
   - `ls`
   - `node --version`
   - `python3 --version`
   - `git --version`
8. Type: `exit` to disconnect

---

## Part 5: Monitoring

### 5.1 Monitor Backend Logs

```bash
# Real-time logs
pm2 logs student-ssh-proxy

# Last 100 lines
pm2 logs student-ssh-proxy --lines 100

# Error logs only
pm2 logs student-ssh-proxy --err
```

### 5.2 Monitor System Resources

```bash
# PM2 monitoring
pm2 monit

# System resources
htop

# Check backend process
pm2 status
```

### 5.3 Check Active Connections

```bash
curl http://localhost:3001/connections
```

---

## Part 6: Before Class Checklist

**24 hours before class:**

- [ ] Verify all 4 VMs are running on Linode
- [ ] Test SSH to each VM from Hostinger
- [ ] Check backend server is running: `pm2 status`
- [ ] Test WebSocket connection to each VM
- [ ] Test full end-to-end from browser
- [ ] Verify GitHub credentials work (try git push on a VM)
- [ ] Check Hostinger server resources (CPU/RAM)
- [ ] Review PM2 logs for any errors
- [ ] Backup current configuration

**Test command:**
```bash
# Run health check script
cd /var/www/student-tui
bash scripts/check-vms.sh
```

---

## Part 7: Class Day Procedures

### During Class

**Student Instructions (display on screen):**

```
1. Go to: https://dinenyc.io
2. Type: mode vm
3. Type: connect vmX  (where X is your assigned VM number)
4. Start coding!

VM Assignments:
- Pairs 1-2: vm1
- Pairs 3-4: vm2
- Pairs 5-6: vm3
- Pairs 7-8: vm4

To disconnect: type "exit"
To save work: git push
```

### Monitoring During Class

```bash
# Watch logs
pm2 logs student-ssh-proxy

# Check connections
curl http://localhost:3001/connections

# System load
htop
```

### After Class

```bash
# Stop backend (optional)
pm2 stop student-ssh-proxy

# Destroy VMs on Linode to stop billing
# Go to Linode Dashboard → Delete each VM
```

---

## Troubleshooting

### Issue: Students can't connect to VM

**Check:**
1. Is backend running? `pm2 status`
2. Can you SSH manually? `ssh -i ~/.ssh/student_vms student@VM_IP`
3. Check backend logs: `pm2 logs student-ssh-proxy`
4. Test WebSocket: `wscat -c wss://dinenyc.io/ws/terminal?vm=vm1`

### Issue: "Connection error" in browser

**Check:**
1. NGINX WebSocket proxy configured correctly?
2. Backend listening on correct port? `curl http://localhost:3001/health`
3. Firewall blocking connections?
4. Check browser console for WebSocket errors (F12)

### Issue: Slow terminal response

**Check:**
1. Hostinger server resources: `htop`
2. Network latency: `ping VM_IP`
3. Too many connections: `curl http://localhost:3001/connections`
4. Backend logs for errors: `pm2 logs`

### Issue: SSH authentication failed

**Check:**
1. SSH key exists on Hostinger: `ls -la ~/.ssh/student_vms`
2. Public key on VM: `ssh root@VM_IP "cat /home/student/.ssh/authorized_keys"`
3. Key permissions: `chmod 600 ~/.ssh/student_vms`
4. Try manual SSH: `ssh -i ~/.ssh/student_vms student@VM_IP`

---

## Cost Summary

### Linode Costs (for testing)

- 4 VMs × $5/month × 2 days = **$1.33**
- With free credits: **$0**

### Hostinger Costs

- Existing hosting plan (no additional cost)

---

## Cleanup After Testing

```bash
# Stop backend
pm2 stop student-ssh-proxy

# Delete Linode VMs via dashboard
# This immediately stops billing
```

---

## Next Steps

After successful deployment and testing:

1. Document any custom configurations
2. Create backup of working setup
3. Schedule real class and provision VMs 1 day before
4. Consider adding monitoring/alerting for production use
5. Review security (if needed for longer-running VMs)

---

## Support

If you encounter issues:

1. Check logs: `pm2 logs student-ssh-proxy`
2. Check health: `curl http://localhost:3001/health`
3. Test SSH manually: `ssh -i ~/.ssh/student_vms student@VM_IP`
4. Review NGINX logs: `sudo tail -f /var/log/nginx/error.log`
