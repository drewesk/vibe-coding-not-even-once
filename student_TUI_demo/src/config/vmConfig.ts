// VM Configuration
// ✓ CONFIGURED 2025-02-11
// Note: This is frontend config - backend has its own vmConfig.js
export const vmList = [
  { id: 'vm1', name: 'VM 1', host: '45.79.139.72' },
  { id: 'vm2', name: 'VM 2', host: '45.79.139.163' },
  { id: 'vm3', name: 'VM 3', host: '69.164.214.31' },
  { id: 'vm4', name: 'VM 4', host: '69.164.214.88' },
] as const

export type VMId = typeof vmList[number]['id']

export function getVMList() {
  return vmList
}

export function getVMById(id: string) {
  return vmList.find(vm => vm.id === id)
}
