#!/bin/bash
#
# Golden VM Setup Script for Student Coding Environment
#
# This script configures a Linode VM with:
# - Node.js 20, Python 3.11, Git
# - OpenCode CLI
# - Pre-configured GitHub access (technycio account)
# - Student user account
# - SSH key access for proxy server
#
# Usage:
#   1. Create Ubuntu 22.04 VM on Linode
#   2. Upload this script: scp setup-golden-vm.sh root@VM_IP:/root/
#   3. SSH into VM and run: bash setup-golden-vm.sh
#   4. Create snapshot of VM
#   5. Clone snapshot to create multiple student VMs
#

set -e  # Exit on error

echo "╔════════════════════════════════════════════╗"
echo "║  Student VM Golden Image Setup             ║"
echo "║  Ubuntu 22.04 + Dev Tools + OpenCode       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root"
    exit 1
fi

# ============================================
# Step 1: Update System
# ============================================
log_info "[1/10] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git build-essential vim nano htop wget software-properties-common
log_success "System updated"

# ============================================
# Step 2: Install Node.js 20
# ============================================
log_info "[2/10] Installing Node.js 20..."
if command -v node &> /dev/null; then
    log_warn "Node.js already installed: $(node --version)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    log_success "Node.js installed: $(node --version)"
fi

# ============================================
# Step 3: Install Python 3.11
# ============================================
log_info "[3/10] Installing Python 3.11..."
apt-get install -y -qq python3.11 python3-pip python3.11-venv python3.11-dev
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
log_success "Python installed: $(python3 --version)"

# ============================================
# Step 4: Install OpenCode (Claude Code CLI)
# ============================================
log_info "[4/10] Installing OpenCode CLI..."
if command -v opencode &> /dev/null; then
    log_warn "OpenCode already installed"
else
    npm install -g @anthropic-ai/opencode 2>&1 | grep -v "npm WARN" || true
    log_success "OpenCode CLI installed"
fi

# ============================================
# Step 5: Create Student User
# ============================================
log_info "[5/10] Creating student user..."
if id "student" &>/dev/null; then
    log_warn "User 'student' already exists"
else
    useradd -m -s /bin/bash student
    echo "student:student123" | chpasswd
    usermod -aG sudo student
    # Allow student to sudo without password (for class convenience)
    echo "student ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/student
    chmod 0440 /etc/sudoers.d/student
    log_success "Student user created"
fi

# ============================================
# Step 6: Configure Student Workspace
# ============================================
log_info "[6/10] Configuring student workspace..."
mkdir -p /home/student/workspace
mkdir -p /home/student/.config
mkdir -p /home/student/projects
mkdir -p /home/student/examples
chown -R student:student /home/student
log_success "Workspace directories created"

# ============================================
# Step 7: Configure Git with technycio Account
# ============================================
log_info "[7/10] Configuring Git..."
sudo -u student git config --global user.name "Student"
sudo -u student git config --global user.email "student@class.local"
sudo -u student git config --global init.defaultBranch main
sudo -u student git config --global credential.helper store

# Pre-configure Git credentials for technycio
log_info "Setting up GitHub access for technycio..."
mkdir -p /home/student/.config
cat > /home/student/.config/git-credentials <<'EOF'
https://technycio:YOUR_GITHUB_TOKEN_HERE@github.com
EOF
chmod 600 /home/student/.config/git-credentials
sudo -u student git config --global credential.helper "store --file=/home/student/.config/git-credentials"
log_success "Git configured with technycio account"

# Test GitHub access
log_info "Testing GitHub authentication..."
if sudo -u student git ls-remote https://github.com/technycio/test-repo.git &>/dev/null 2>&1; then
    log_success "GitHub authentication successful"
else
    log_warn "GitHub test failed (repo may not exist yet - this is OK)"
fi

# ============================================
# Step 8: Configure Bash Environment
# ============================================
log_info "[8/10] Configuring shell environment..."
cat > /home/student/.bashrc <<'EOFBASH'
# Student Coding Environment Configuration

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# History settings
HISTCONTROL=ignoreboth
HISTSIZE=1000
HISTFILESIZE=2000
shopt -s histappend

# Check window size after each command
shopt -s checkwinsize

# Colored prompt
export PS1='\[\e[32m\]\u@\h\[\e[0m\]:\[\e[34m\]\w\[\e[0m\]\$ '

# Colored ls
alias ls='ls --color=auto'
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

# Environment variables
export PATH=$PATH:/usr/local/bin
export EDITOR=nano
export VISUAL=nano

# OpenCode API Key (if needed - update with your key)
# export ANTHROPIC_API_KEY="your-key-here"

# Auto-change to workspace on login
if [ -d "$HOME/workspace" ] && [ "$PWD" = "$HOME" ]; then
    cd ~/workspace
fi

# Welcome message
if [ ! -f ~/.hushlogin ]; then
    echo "╔════════════════════════════════════════════╗"
    echo "║   Student Coding Environment               ║"
    echo "║                                            ║"
    echo "║   Tools Available:                         ║"
    echo "║   - Node.js $(node --version | cut -d'v' -f2)                              ║"
    echo "║   - Python $(python3 --version | cut -d' ' -f2)                           ║"
    echo "║   - OpenCode CLI                           ║"
    echo "║   - Git (configured for technycio)         ║"
    echo "║                                            ║"
    echo "║   Workspace: ~/workspace                   ║"
    echo "║                                            ║"
    echo "║   Commands:                                ║"
    echo "║   - opencode        Start AI assistant     ║"
    echo "║   - node <file>     Run JavaScript         ║"
    echo "║   - python3 <file>  Run Python             ║"
    echo "║   - git push        Push to GitHub         ║"
    echo "║                                            ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""
fi
EOFBASH

chown student:student /home/student/.bashrc
log_success "Bash environment configured"

# Create .hushlogin to control welcome message display
touch /home/student/.hushlogin
chown student:student /home/student/.hushlogin

# ============================================
# Step 9: Configure SSH Access
# ============================================
log_info "[9/10] Configuring SSH access..."
mkdir -p /home/student/.ssh
chmod 700 /home/student/.ssh

cat > /home/student/.ssh/authorized_keys <<'EOF'
# SSH Public Key for Backend Proxy Server
# ADD YOUR SSH PUBLIC KEY HERE
# 
# Generate on your server:
#   ssh-keygen -t rsa -b 4096 -f ~/.ssh/student_vms -N ""
#
# Then copy the contents of ~/.ssh/student_vms.pub here
#
# Example format:
# ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC... your-key-here
EOF

chmod 600 /home/student/.ssh/authorized_keys
chown -R student:student /home/student/.ssh
log_success "SSH directory configured"

log_warn "⚠️  IMPORTANT: You must add your SSH public key to /home/student/.ssh/authorized_keys"
log_warn "⚠️  Edit: nano /home/student/.ssh/authorized_keys"

# ============================================
# Step 10: Create Example Projects
# ============================================
log_info "[10/10] Creating example projects..."

# Node.js Hello World
mkdir -p /home/student/examples/nodejs-hello
cat > /home/student/examples/nodejs-hello/app.js <<'EOFJS'
// Simple Node.js Hello World
console.log('Hello from Node.js!');
console.log('Node version:', process.version);
EOFJS

cat > /home/student/examples/nodejs-hello/package.json <<'EOFJSON'
{
  "name": "nodejs-hello",
  "version": "1.0.0",
  "description": "Simple Node.js example",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  }
}
EOFJSON

# Python Hello World
mkdir -p /home/student/examples/python-hello
cat > /home/student/examples/python-hello/app.py <<'EOFPY'
#!/usr/bin/env python3
# Simple Python Hello World
import sys

def main():
    print('Hello from Python!')
    print(f'Python version: {sys.version}')

if __name__ == '__main__':
    main()
EOFPY
chmod +x /home/student/examples/python-hello/app.py

# README
cat > /home/student/examples/README.md <<'EOFMD'
# Example Projects

## Node.js Hello World
```bash
cd nodejs-hello
node app.js
```

## Python Hello World
```bash
cd python-hello
python3 app.py
```

## Your Projects
Create your projects in `~/workspace/`
EOFMD

chown -R student:student /home/student/examples
log_success "Example projects created"

# ============================================
# Verification
# ============================================
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║          Verification                      ║"
echo "╚════════════════════════════════════════════╝"

verify_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 installed: $($1 $2 2>&1 | head -1)"
    else
        echo -e "${RED}✗${NC} $1 NOT FOUND"
    fi
}

verify_command "node" "--version"
verify_command "npm" "--version"
verify_command "python3" "--version"
verify_command "git" "--version"
verify_command "opencode" "--version"

echo ""
log_success "Golden VM setup complete!"
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║          Next Steps                        ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "1. Add your SSH public key:"
echo "   nano /home/student/.ssh/authorized_keys"
echo ""
echo "2. Test SSH access from your server:"
echo "   ssh -i ~/.ssh/student_vms student@$(hostname -I | awk '{print $1}')"
echo ""
echo "3. Create Linode snapshot:"
echo "   - Go to Linode dashboard"
echo "   - Select this VM"
echo "   - Click 'Create Snapshot'"
echo "   - Name: student-vm-golden-$(date +%Y%m%d)"
echo ""
echo "4. Clone snapshot to create 4 student VMs"
echo ""
echo "5. Update backend server/vmConfig.js with VM IPs"
echo ""
log_info "VM IP address: $(hostname -I | awk '{print $1}')"
echo ""
