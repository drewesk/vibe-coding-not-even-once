#!/bin/bash
#
# Update VM IP Addresses in Configuration Files
#
# Usage:
#   ./update-vm-ips.sh vm1 192.168.1.101
#   ./update-vm-ips.sh vm2 192.168.1.102
#   etc.
#

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <vm-id> <ip-address>"
    echo "Example: $0 vm1 192.168.1.101"
    exit 1
fi

VM_ID="$1"
VM_IP="$2"

# Validate VM ID
if [[ ! "$VM_ID" =~ ^vm[1-4]$ ]]; then
    echo "Error: VM ID must be vm1, vm2, vm3, or vm4"
    exit 1
fi

# Validate IP address format
if [[ ! "$VM_IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "Error: Invalid IP address format"
    exit 1
fi

echo "Updating $VM_ID to IP: $VM_IP"

# Update backend config
BACKEND_CONFIG="server/vmConfig.js"
if [ -f "$BACKEND_CONFIG" ]; then
    # Get VM number
    VM_NUM="${VM_ID:2}"
    
    # Update using sed
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/LINODE_IP_${VM_NUM}/${VM_IP}/g" "$BACKEND_CONFIG"
    else
        # Linux
        sed -i "s/LINODE_IP_${VM_NUM}/${VM_IP}/g" "$BACKEND_CONFIG"
    fi
    
    echo "✓ Updated $BACKEND_CONFIG"
else
    echo "✗ Backend config not found: $BACKEND_CONFIG"
fi

echo "Done! $VM_ID is now configured with IP $VM_IP"
echo ""
echo "To verify, run:"
echo "  ssh -i ~/.ssh/student_vms student@$VM_IP"
