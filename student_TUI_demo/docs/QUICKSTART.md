# Quick Start Guide - Student TUI with VM Access

Fast setup guide for getting the Student TUI with real VM access running.

## What You've Built

- ✅ **Frontend**: React TUI with 3 modes (Story, Base, VM)
- ✅ **Backend**: WebSocket SSH proxy server
- ✅ **VM Setup Script**: Automated Linode VM configuration
- ✅ **4 Test VMs**: Ready to provision on Linode

## Architecture

```
Students (Browser)
    ↓ WebSocket (wss://dinenyc.io/ws/terminal)
Hostinger Server (Backend SSH Proxy)
    ↓ SSH (port 22)
Linode VMs (4x Ubuntu 22.04)
```

## Quick Setup (30 minutes)

### Step 1: Generate SSH Keys on Hostinger (2 min)

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/student_vms -N ""
cat ~/.ssh/student_vms.pub  # Copy this
```

### Step 2: Create Golden VM on Linode (5 min)

1. Linode Dashboard → Create Linode
2. Ubuntu 22.04, Nanode 1GB, label: student-vm-golden
3. Wait for boot

### Step 3: Configure Golden VM (5 min)

```bash
# Upload setup script
scp scripts/setup-golden-vm.sh root@VM_IP:/root/

# SSH and run
ssh root@VM_IP
bash /root/setup-golden-vm.sh

# Add your SSH public key
nano /home/student/.ssh/authorized_keys
# Paste the key from Step 1, save

# Test connection from Hostinger
ssh -i ~/.ssh/student_vms student@VM_IP
```

### Step 4: Create Snapshot and Clone (10 min)

1. Linode Dashboard → Storage → Create Snapshot
2. Name: student-vm-golden-2025-02-11
3. Wait for snapshot (5 min)
4. Create 4 VMs from snapshot:
   - student-vm-1
   - student-vm-2
   - student-vm-3
   - student-vm-4

### Step 5: Deploy Backend on Hostinger (5 min)

```bash
# Install backend dependencies
cd /var/www/student-tui/server
npm install

# Create .env
cat > .env <<EOF
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
SSH_PRIVATE_KEY_PATH=/home/user/.ssh/student_vms
EOF

# Update VM IPs in vmConfig.js
nano vmConfig.js
# Replace LINODE_IP_1, LINODE_IP_2, etc. with actual IPs

# Start with PM2
pm2 start index.js --name student-ssh-proxy
pm2 save
```

### Step 6: Configure NGINX (3 min)

Add to your nginx config:

```nginx
location /ws/terminal {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 7200s;
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: Test Everything (5 min)

```bash
# Test backend
curl http://localhost:3001/health

# Test from browser
# 1. Open https://dinenyc.io
# 2. Type: mode vm
# 3. Type: connect vm1
# 4. Should see SSH session!
```

## Common Commands

### Backend Management

```bash
# Start
pm2 start student-ssh-proxy

# Stop
pm2 stop student-ssh-proxy

# Restart
pm2 restart student-ssh-proxy

# View logs
pm2 logs student-ssh-proxy

# Status
pm2 status
```

### Testing VMs

```bash
# Check all VMs
bash scripts/check-vms.sh

# Manual SSH test
ssh -i ~/.ssh/student_vms student@VM_IP

# Health check
curl http://localhost:3001/health
```

### Monitoring

```bash
# Active connections
curl http://localhost:3001/connections

# System resources
htop

# Backend logs
pm2 logs student-ssh-proxy --lines 50
```

## Student Usage

```
1. Visit: https://dinenyc.io
2. Type: mode vm
3. Type: connect vm1
4. Start coding!
5. To disconnect: exit
6. To save: git push
```

## File Locations

```
/var/www/student-tui/
├── server/               # Backend SSH proxy
│   ├── index.js         # Main server
│   ├── sshProxy.js      # SSH connection manager
│   ├── vmConfig.js      # VM IPs (UPDATE THIS)
│   └── .env             # Environment config
├── scripts/
│   ├── setup-golden-vm.sh    # VM setup script
│   ├── check-vms.sh          # Health check
│   └── update-vm-ips.sh      # IP updater
├── dist/                # Frontend build
└── docs/                # Documentation
```

## Key Configuration Files

### Backend VM Config
`server/vmConfig.js` - Update VM IPs here

### Backend Environment
`server/.env` - SSH key path and port

### Frontend VM Config
`src/config/vmConfig.ts` - Frontend VM list (matches backend)

## Troubleshooting

### Can't connect to VM
```bash
# Test SSH manually
ssh -i ~/.ssh/student_vms student@VM_IP

# Check backend logs
pm2 logs student-ssh-proxy
```

### Backend not running
```bash
pm2 status
pm2 start student-ssh-proxy
```

### WebSocket fails
```bash
# Check NGINX config
sudo nginx -t

# Check backend health
curl http://localhost:3001/health
```

## Cost Estimate

- **Testing (2 days)**: 4 VMs × $5/month × 2 days = $1.33
- **With Linode free credits**: $0

## Cleanup After Testing

```bash
# Stop backend
pm2 stop student-ssh-proxy

# Delete VMs on Linode dashboard (stops billing immediately)
```

## Full Documentation

- Backend README: `server/README.md`
- Hostinger Deployment: `docs/hostinger-deployment.md`
- Frontend implementation details in component files

## Need Help?

1. Check logs: `pm2 logs student-ssh-proxy`
2. Test manually: `ssh -i ~/.ssh/student_vms student@VM_IP`
3. Review health: `curl http://localhost:3001/health`
4. Check connections: `curl http://localhost:3001/connections`

---

**Ready to deploy! Follow the steps above and you'll have a working system in 30 minutes.** 🚀
