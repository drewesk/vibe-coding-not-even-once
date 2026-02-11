/**
 * VM Configuration for SSH Proxy
 * 
 * UPDATE THESE IPs AFTER CREATING LINODE VMs
 * 
 * To update:
 * 1. Create VMs on Linode
 * 2. Note each VM's public IP address
 * 3. Replace LINODE_IP_X with actual IPs below
 */

export const vmConfigs = {
  vm1: {
    id: 'vm1',
    displayName: 'VM 1',
    host: '45.79.139.72',  // ✓ CONFIGURED
    port: 22,
    username: 'student',
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH || '/Users/user/.ssh/student_vms'
  },
  vm2: {
    id: 'vm2',
    displayName: 'VM 2',
    host: '45.79.139.163',  // ✓ CONFIGURED
    port: 22,
    username: 'student',
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH || '/Users/user/.ssh/student_vms'
  },
  vm3: {
    id: 'vm3',
    displayName: 'VM 3',
    host: '69.164.214.31',  // ✓ CONFIGURED
    port: 22,
    username: 'student',
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH || '/Users/user/.ssh/student_vms'
  },
  vm4: {
    id: 'vm4',
    displayName: 'VM 4',
    host: '69.164.214.88',  // ✓ CONFIGURED
    port: 22,
    username: 'student',
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH || '/Users/user/.ssh/student_vms'
  }
}

/**
 * Get VM configuration by ID
 * @param {string} vmId - VM identifier (vm1, vm2, etc.)
 * @returns {object} VM configuration object
 * @throws {Error} If VM ID is unknown
 */
export function getVMConfig(vmId) {
  const config = vmConfigs[vmId]
  if (!config) {
    throw new Error(`Unknown VM ID: ${vmId}`)
  }
  return config
}

/**
 * Get list of all available VM IDs
 * @returns {string[]} Array of VM IDs
 */
export function getAllVMIds() {
  return Object.keys(vmConfigs)
}

/**
 * Validate that all VMs have proper configuration
 * @returns {object} Validation result with warnings
 */
export function validateVMConfigs() {
  const warnings = []
  const vmIds = getAllVMIds()
  
  for (const vmId of vmIds) {
    const config = vmConfigs[vmId]
    
    if (config.host.startsWith('LINODE_IP_')) {
      warnings.push(`${vmId}: Host IP not configured (still placeholder)`)
    }
    
    if (!config.privateKeyPath) {
      warnings.push(`${vmId}: Private key path not set`)
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
    vmCount: vmIds.length
  }
}
