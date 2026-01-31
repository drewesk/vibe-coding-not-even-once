import type { BaseFsNode } from '../types'

export const DEFAULT_HOME = '/home/agent'

export const createDefaultBaseFs = (): BaseFsNode => ({
  type: 'dir',
  name: '/',
  children: {
    home: {
      type: 'dir',
      name: 'home',
      children: {
        agent: {
          type: 'dir',
          name: 'agent',
          children: {
            'readme.txt': {
              type: 'file',
              name: 'readme.txt',
              content: 'Welcome to base mode.\nUse "help" for commands.\n',
            },
            'notes.txt': {
              type: 'file',
              name: 'notes.txt',
              content: 'This is a sandbox filesystem.\n',
            },
          },
        },
      },
    },
    projects: {
      type: 'dir',
      name: 'projects',
      children: {},
    },
    tmp: {
      type: 'dir',
      name: 'tmp',
      children: {},
    },
  },
})

export const cloneFs = (node: BaseFsNode): BaseFsNode => {
  if (node.type === 'file') {
    return { ...node }
  }
  const children: Record<string, BaseFsNode> = {}
  Object.entries(node.children).forEach(([key, child]) => {
    children[key] = cloneFs(child)
  })
  return { ...node, children }
}

export const resolvePath = (cwd: string, input: string) => {
  const base = input && input.startsWith('/') ? input : `${cwd}/${input}`
  const rawParts = base.split('/')
  const parts: string[] = []
  rawParts.forEach((part) => {
    if (!part || part === '.') {
      return
    }
    if (part === '..') {
      parts.pop()
      return
    }
    parts.push(part)
  })
  return parts.length === 0 ? '/' : `/${parts.join('/')}`
}

export const splitPath = (path: string) => {
  if (path === '/') {
    return []
  }
  return path.replace(/^\/+/, '').split('/').filter(Boolean)
}

export const getNodeAtPath = (root: BaseFsNode, path: string) => {
  let node: BaseFsNode | undefined = root
  for (const part of splitPath(path)) {
    if (!node || node.type !== 'dir') {
      return null
    }
    node = node.children[part]
  }
  return node ?? null
}

export const getParentDir = (root: BaseFsNode, path: string) => {
  const parts = splitPath(path)
  if (parts.length === 0) {
    return null
  }
  const name = parts.pop() as string
  const parentPath = parts.length === 0 ? '/' : `/${parts.join('/')}`
  const parent = getNodeAtPath(root, parentPath)
  if (!parent || parent.type !== 'dir') {
    return null
  }
  return { parent, name, parentPath }
}
