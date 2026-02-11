#!/bin/bash
#
# Check Health of All Student VMs
#
# Tests SSH connectivity to all VMs listed in server/vmConfig.js
#

set -e

echo "╔════════════════════════════════════════════╗"
echo "║     Student VM Health Check                ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# SSH key path
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/student_vms}"

if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}✗${NC} SSH key not found: $SSH_KEY"
    echo "Generate one with: ssh-keygen -t rsa -b 4096 -f ~/.ssh/student_vms -N \"\""
    exit 1
fi

echo "Using SSH key: $SSH_KEY"
echo ""

# Read VM IPs from backend config
# Note: This is a simple parser - update manually if needed
VM_IPS=(
    "LINODE_IP_1"
    "LINODE_IP_2"
    "LINODE_IP_3"
    "LINODE_IP_4"
)

check_vm() {
    local vm_id=$1
    local vm_ip=$2
    
    printf "Checking %-6s (%s)... " "$vm_id" "$vm_ip"
    
    if [ "$vm_ip" = "LINODE_IP_"* ]; then
        echo -e "${YELLOW}SKIP${NC} (IP not configured)"
        return
    fi
    
    # Test SSH connection with timeout
    if timeout 10 ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 student@"$vm_ip" "echo OK" &>/dev/null; then
        echo -e "${GREEN}✓ OK${NC}"
        
        # Get additional info
        node_version=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no student@"$vm_ip" "node --version 2>/dev/null" || echo "N/A")
        echo "  └─ Node.js: $node_version"
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  └─ Cannot connect via SSH"
    fi
}

# Check each VM
for i in {1..4}; do
    vm_id="vm$i"
    vm_ip="${VM_IPS[$i-1]}"
    check_vm "$vm_id" "$vm_ip"
    echo ""
done

echo "╔════════════════════════════════════════════╗"
echo "║     Health Check Complete                  ║"
echo "╚════════════════════════════════════════════╝"
