# Deployment Checklist - Student TUI with VM Access

Use this checklist to deploy the system step-by-step.

## Prerequisites

- [ ] Hostinger VPS with SSH access
- [ ] Domain DineNYC.io pointed to Hostinger
- [ ] Linode account with free credits
- [ ] Node.js 18+ on Hostinger
- [ ] NGINX installed on Hostinger

---

## Phase 1: Linode VM Setup

### Step 1: Generate SSH Keys (on Hostinger)

- [ ] SSH into Hostinger server
- [ ] Run: `ssh-keygen -t rsa -b 4096 -f ~/.ssh/student_vms -N ""`
- [ ] Run: `cat ~/.ssh/student_vms.pub` and copy output
- [ ] Save public key somewhere safe

### Step 2: Create Golden VM

- [ ] Log into Linode dashboard
- [ ] Click "Create Linode"
- [ ] Select:
  - [ ] Distribution: Ubuntu 22.04 LTS
  - [ ] Plan: Nanode 1GB ($5/month)
  - [ ] Region: (closest to Hostinger)
  - [ ] Label: student-vm-golden
- [ ] Click "Create Linode"
- [ ] Wait for VM to boot (~30 seconds)
- [ ] Copy VM root password from Linode dashboard

### Step 3: Configure Golden VM

- [ ] From your local machine: `scp scripts/setup-golden-vm.sh root@GOLDEN_VM_IP:/root/`
- [ ] SSH into golden VM: `ssh root@GOLDEN_VM_IP`
- [ ] Run setup script: `bash /root/setup-golden-vm.sh`
- [ ] Wait 3-5 minutes for script to complete
- [ ] Edit authorized_keys: `nano /home/student/.ssh/authorized_keys`
- [ ] Paste your SSH public key (from Step 1)
- [ ] Save and exit (Ctrl+X, Y, Enter)
- [ ] Exit VM: `exit`

### Step 4: Test SSH Connection

- [ ] From Hostinger: `ssh -i ~/.ssh/student_vms student@GOLDEN_VM_IP`
- [ ] Should connect without password
- [ ] Try: `node --version` (should see v20.x.x)
- [ ] Try: `python3 --version` (should see 3.11.x)
- [ ] Try: `git --version`
- [ ] Exit: `exit`

### Step 5: Create Snapshot

- [ ] Go to Linode dashboard
- [ ] Select your golden VM
- [ ] Click "Storage" tab
- [ ] Click "Create Snapshot"
- [ ] Name: `student-vm-golden-20250211`
- [ ] Click "Take Snapshot"
- [ ] Wait 5-10 minutes for snapshot to complete
- [ ] Verify snapshot shows "Available"

### Step 6: Clone VMs from Snapshot

Repeat for VM 1, 2, 3, 4:

- [ ] **VM 1:**
  - [ ] Click "Create Linode"
  - [ ] Click "Backups" tab
  - [ ] Select your golden snapshot
  - [ ] Plan: Nanode 1GB
  - [ ] Label: student-vm-1
  - [ ] Create
  - [ ] Record IP: `_________________`

- [ ] **VM 2:**
  - [ ] Same process
  - [ ] Label: student-vm-2
  - [ ] Record IP: `_________________`

- [ ] **VM 3:**
  - [ ] Same process
  - [ ] Label: student-vm-3
  - [ ] Record IP: `_________________`

- [ ] **VM 4:**
  - [ ] Same process
  - [ ] Label: student-vm-4
  - [ ] Record IP: `_________________`

### Step 7: Test All VMs

- [ ] From Hostinger: `ssh -i ~/.ssh/student_vms student@VM1_IP`
- [ ] Verify works, then exit
- [ ] Repeat for VM2, VM3, VM4
- [ ] All 4 VMs should be accessible

---

## Phase 2: Deploy to Hostinger

### Step 8: Upload Project

From your **local machine**:

- [ ] Compress project: `tar -czf student-tui.tar.gz --exclude=node_modules --exclude=dist .`
- [ ] Upload: `scp student-tui.tar.gz user@dinenyc.io:/home/user/`
- [ ] SSH into Hostinger: `ssh user@dinenyc.io`
- [ ] Extract: `tar -xzf student-tui.tar.gz`
- [ ] Move to web directory: `mv student_TUI_demo /var/www/student-tui`
- [ ] Change to directory: `cd /var/www/student-tui`

### Step 9: Install Dependencies

- [ ] Install frontend: `npm install`
- [ ] Build frontend: `npm run build`
- [ ] Verify dist/ created: `ls -la dist/`
- [ ] Install backend: `cd server && npm install && cd ..`

### Step 10: Configure Backend

- [ ] Change to server: `cd server`
- [ ] Create .env file:
  ```bash
  cat > .env << EOF
  PORT=3001
  HOST=0.0.0.0
  NODE_ENV=production
  SSH_PRIVATE_KEY_PATH=/home/user/.ssh/student_vms
  EOF
  ```
- [ ] Edit vmConfig.js: `nano vmConfig.js`
- [ ] Replace LINODE_IP_1 with VM1 IP
- [ ] Replace LINODE_IP_2 with VM2 IP
- [ ] Replace LINODE_IP_3 with VM3 IP
- [ ] Replace LINODE_IP_4 with VM4 IP
- [ ] Save and exit
- [ ] Back to root: `cd ..`

### Step 11: Test Backend Manually

- [ ] Start backend: `cd server && node index.js`
- [ ] Should see: "✅ Server running on 0.0.0.0:3001"
- [ ] Check for warnings (VM IPs should be real now, not LINODE_IP_X)
- [ ] Open new terminal
- [ ] Test health: `curl http://localhost:3001/health`
- [ ] Should return JSON with VM info
- [ ] Stop backend: Ctrl+C in first terminal

### Step 12: Install PM2 and Start Backend

- [ ] Install PM2: `npm install -g pm2`
- [ ] Start backend: `pm2 start server/index.js --name student-ssh-proxy`
- [ ] Check status: `pm2 status` (should show "online")
- [ ] View logs: `pm2 logs student-ssh-proxy --lines 20`
- [ ] Save PM2 config: `pm2 save`
- [ ] Setup startup: `pm2 startup` (follow instructions)

---

## Phase 3: Configure NGINX

### Step 13: Update NGINX Configuration

- [ ] Backup existing config: `sudo cp /etc/nginx/sites-available/dinenyc.io /etc/nginx/sites-available/dinenyc.io.backup`
- [ ] Edit config: `sudo nano /etc/nginx/sites-available/dinenyc.io`
- [ ] Add location blocks (see docs/hostinger-deployment.md for full config):

```nginx
# Add these location blocks inside the server block

location / {
    root /var/www/student-tui/dist;
    try_files $uri $uri/ /index.html;
}

location /ws/terminal {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 7200s;
    proxy_send_timeout 7200s;
}
```

- [ ] Save and exit
- [ ] Test NGINX config: `sudo nginx -t`
- [ ] If OK, reload: `sudo systemctl reload nginx`

### Step 14: Configure Firewall

- [ ] Allow SSH: `sudo ufw allow 22/tcp`
- [ ] Allow HTTP: `sudo ufw allow 80/tcp`
- [ ] Allow HTTPS: `sudo ufw allow 443/tcp`
- [ ] Enable firewall: `sudo ufw enable`
- [ ] Check status: `sudo ufw status`

---

## Phase 4: Testing

### Step 15: Backend Tests

- [ ] Health check: `curl http://localhost:3001/health`
- [ ] Should return JSON with 4 VMs listed
- [ ] No warnings about LINODE_IP_X
- [ ] Check connections: `curl http://localhost:3001/connections`
- [ ] Should return empty array (no active connections yet)

### Step 16: SSH Tests

- [ ] Run health script: `cd /var/www/student-tui && bash scripts/check-vms.sh`
- [ ] All 4 VMs should show ✓ OK
- [ ] Each should show Node.js version

### Step 17: WebSocket Test

From your **local machine**:

- [ ] Install wscat: `npm install -g wscat`
- [ ] Test VM1: `wscat -c wss://dinenyc.io/ws/terminal?vm=vm1`
- [ ] Should see: Connected
- [ ] Should see SSH connection established
- [ ] Type: `ls` and press Enter
- [ ] Should see command output
- [ ] Press Ctrl+C to disconnect
- [ ] Test VM2: `wscat -c wss://dinenyc.io/ws/terminal?vm=vm2`
- [ ] Verify works
- [ ] Test VM3 and VM4 similarly

### Step 18: Browser End-to-End Test

- [ ] Open browser: `https://dinenyc.io`
- [ ] Should see Student TUI interface
- [ ] Type: `mode vm` and press Enter
- [ ] Should see VM selection menu with nice ASCII box
- [ ] Type: `connect vm1` and press Enter
- [ ] Should see:
  - "Connecting to VM 1..."
  - "Establishing SSH connection..."
  - "Connected to VM 1"
  - SSH prompt: `student@student-vm-1:~/workspace$`
- [ ] Type: `ls` - should work
- [ ] Type: `pwd` - should show `/home/student/workspace`
- [ ] Type: `node --version` - should show v20.x.x
- [ ] Type: `python3 --version` - should show 3.11.x
- [ ] Type: `git --version` - should work
- [ ] Type: `exit` - should disconnect
- [ ] Should return to VM mode menu
- [ ] Test connecting to VM2, VM3, VM4 similarly

### Step 19: Multi-User Test

- [ ] Open 2 browser windows
- [ ] Connect window 1 to VM1
- [ ] Connect window 2 to VM1
- [ ] In window 1: `echo "test" > test.txt`
- [ ] In window 2: `cat test.txt`
- [ ] Should see "test" (shared filesystem)
- [ ] Both terminals should work independently

---

## Phase 5: Pre-Class Final Checks

### Step 20: 24 Hours Before Class

- [ ] Verify all 4 VMs running on Linode dashboard
- [ ] Check Hostinger server resources: `htop`
- [ ] Check PM2 status: `pm2 status`
- [ ] Check PM2 logs: `pm2 logs student-ssh-proxy --lines 50`
- [ ] Run health check: `bash scripts/check-vms.sh`
- [ ] Test from browser (all 4 VMs)
- [ ] Check NGINX logs: `sudo tail -50 /var/log/nginx/error.log`
- [ ] Verify SSL certificate valid
- [ ] Create VM assignment list for students

### Step 21: Class Day Morning

- [ ] Check all VMs still running
- [ ] Restart backend: `pm2 restart student-ssh-proxy`
- [ ] Check logs: `pm2 logs student-ssh-proxy`
- [ ] Test one VM connection from browser
- [ ] Prepare monitoring terminal: `pm2 logs student-ssh-proxy`
- [ ] Prepare student instructions (display on projector)

---

## Student Instructions Template

Display this on screen during class:

```
╔════════════════════════════════════════════════╗
║  Welcome to AI-Assisted Coding Workshop!      ║
╚════════════════════════════════════════════════╝

WEBSITE: https://dinenyc.io

STEPS:
1. Type: mode vm
2. Type: connect vmX  (see your assignment below)
3. Start coding!

VM ASSIGNMENTS:
  Pairs 1-2  → vm1
  Pairs 3-4  → vm2
  Pairs 5-6  → vm3
  Pairs 7-8  → vm4

COMMANDS:
  ls              - List files
  node app.js     - Run JavaScript
  python3 app.py  - Run Python
  git push        - Save your work
  exit            - Disconnect

BEFORE CLASS ENDS:
  git add .
  git commit -m "Class work"
  git push
```

---

## After Class

### Step 22: Cleanup

- [ ] Give students 5 minutes warning to push code
- [ ] Wait for all students to disconnect
- [ ] (Optional) Backup student work from VMs
- [ ] Go to Linode dashboard
- [ ] Delete student-vm-1
- [ ] Delete student-vm-2  
- [ ] Delete student-vm-3
- [ ] Delete student-vm-4
- [ ] Keep golden VM or delete if not needed
- [ ] Stop backend: `pm2 stop student-ssh-proxy` (optional)
- [ ] Save logs: `pm2 logs student-ssh-proxy --lines 500 > class-logs-$(date +%Y%m%d).txt`

---

## Troubleshooting During Class

### Student can't connect

- [ ] Check VM is running on Linode
- [ ] Check PM2 status: `pm2 status`
- [ ] Check PM2 logs: `pm2 logs student-ssh-proxy`
- [ ] Test SSH manually: `ssh -i ~/.ssh/student_vms student@VM_IP`
- [ ] Check NGINX: `sudo systemctl status nginx`

### Slow terminal

- [ ] Check server load: `htop`
- [ ] Check connections: `curl http://localhost:3001/connections`
- [ ] Check network: `ping VM_IP`
- [ ] Check PM2 logs for errors

### Backend crashed

- [ ] Restart: `pm2 restart student-ssh-proxy`
- [ ] Check logs: `pm2 logs student-ssh-proxy --lines 100`
- [ ] Check health: `curl http://localhost:3001/health`

---

## Success Criteria

- [ ] All 4 VMs accessible via SSH from Hostinger
- [ ] Backend running and healthy
- [ ] WebSocket connections work
- [ ] Browser terminal connects to all VMs
- [ ] Students can run Node.js code
- [ ] Students can run Python code
- [ ] Students can use git push
- [ ] Multiple students can use same VM
- [ ] Exit/disconnect works properly
- [ ] Mode switching works (vm ↔ story ↔ base)

---

## Deployment Complete! 🎉

**You now have:**
- ✅ 4 working Linode VMs
- ✅ SSH proxy backend running on Hostinger
- ✅ Frontend deployed with VM mode
- ✅ NGINX configured for WebSocket
- ✅ End-to-end testing passed

**Ready for class!** 🚀

---

## Quick Reference

**SSH to VM:**
```bash
ssh -i ~/.ssh/student_vms student@VM_IP
```

**Check backend:**
```bash
pm2 status
pm2 logs student-ssh-proxy
curl http://localhost:3001/health
```

**Test WebSocket:**
```bash
wscat -c wss://dinenyc.io/ws/terminal?vm=vm1
```

**Health check:**
```bash
cd /var/www/student-tui
bash scripts/check-vms.sh
```
