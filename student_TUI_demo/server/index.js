#!/usr/bin/env node

/**
 * Student TUI SSH Proxy Server
 * 
 * WebSocket server that proxies terminal connections to Linode VMs via SSH
 * Allows students to access real Linux environments from their browser
 */

import express from 'express'
import { WebSocketServer } from 'ws'
import { SSHProxy } from './sshProxy.js'
import { getAllVMIds, validateVMConfigs } from './vmConfig.js'
import dotenv from 'dotenv'
import { createServer } from 'http'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'

// Track active connections
const activeConnections = new Map()
let connectionCounter = 0

/**
 * Create a logger for a specific session
 */
function createLogger(sessionId, vmId) {
  const prefix = `[${sessionId}] [${vmId}]`
  return {
    info: (msg) => console.log(`${prefix} ℹ️  ${msg}`),
    warn: (msg) => console.warn(`${prefix} ⚠️  ${msg}`),
    error: (msg) => console.error(`${prefix} ❌ ${msg}`)
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const validation = validateVMConfigs()
  
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    availableVMs: getAllVMIds(),
    activeConnections: activeConnections.size,
    vmValidation: validation,
    timestamp: new Date().toISOString()
  })
})

/**
 * Info endpoint
 */
app.get('/info', (req, res) => {
  res.json({
    service: 'Student TUI SSH Proxy',
    version: '1.0.0',
    availableVMs: getAllVMIds(),
    activeConnections: activeConnections.size,
    websocketPath: '/ws/terminal'
  })
})

/**
 * Active connections endpoint (for monitoring)
 */
app.get('/connections', (req, res) => {
  const connections = []
  activeConnections.forEach((proxy, sessionId) => {
    connections.push({
      sessionId,
      vmId: proxy.vmId,
      connected: proxy.isActive(),
      startTime: proxy.startTime
    })
  })
  res.json({
    count: connections.length,
    connections
  })
})

// Create HTTP server
const server = createServer(app)

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/ws/terminal'
})

console.log('🚀 Student TUI SSH Proxy Server')
console.log('================================')
console.log(`📦 Available VMs: ${getAllVMIds().join(', ')}`)

// Validate VM configuration on startup
const validation = validateVMConfigs()
if (!validation.valid) {
  console.warn('⚠️  VM Configuration Warnings:')
  validation.warnings.forEach(warning => console.warn(`   - ${warning}`))
  console.warn('⚠️  Update server/vmConfig.js with actual Linode IPs')
}

/**
 * Handle WebSocket connections
 */
wss.on('connection', async (ws, req) => {
  connectionCounter++
  const sessionId = `sess-${connectionCounter}-${Date.now().toString(36)}`
  
  // Parse VM ID from query string
  const url = new URL(req.url, `http://${req.headers.host}`)
  const vmId = url.searchParams.get('vm')

  const logger = createLogger(sessionId, vmId || 'unknown')
  logger.info('WebSocket connection received')

  // Validate VM ID
  if (!vmId) {
    logger.error('Missing vm parameter in connection')
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Missing vm parameter. Use: ws://server/ws/terminal?vm=vm1' 
    }))
    ws.close(1008, 'Missing vm parameter')
    return
  }

  const availableVMs = getAllVMIds()
  if (!availableVMs.includes(vmId)) {
    logger.error(`Invalid VM ID: ${vmId}`)
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: `Invalid VM ID: ${vmId}. Available VMs: ${availableVMs.join(', ')}` 
    }))
    ws.close(1008, 'Invalid VM ID')
    return
  }

  // Create SSH proxy
  const proxy = new SSHProxy(ws, vmId, logger)
  proxy.startTime = new Date().toISOString()
  activeConnections.set(sessionId, proxy)

  logger.info(`Active connections: ${activeConnections.size}`)

  // Attempt SSH connection
  try {
    await proxy.connect()
    logger.info('SSH connection established successfully')
    ws.send(JSON.stringify({ 
      type: 'connected', 
      vm: vmId,
      sessionId 
    }))
  } catch (error) {
    logger.error(`SSH connection failed: ${error.message}`)
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: `Connection failed: ${error.message}` 
    }))
    ws.close(1011, 'SSH connection failed')
    activeConnections.delete(sessionId)
    return
  }

  /**
   * Handle incoming WebSocket messages
   */
  ws.on('message', (data) => {
    try {
      // Try to parse as JSON (control messages)
      const message = JSON.parse(data)
      
      if (message.type === 'input') {
        // Terminal input from browser
        proxy.handleInput(message.data)
      } else if (message.type === 'resize') {
        // Terminal resize event
        proxy.handleResize(message.rows, message.cols)
      } else {
        logger.warn(`Unknown message type: ${message.type}`)
      }
    } catch (error) {
      // Not JSON, treat as raw terminal input
      proxy.handleInput(data)
    }
  })

  /**
   * Handle WebSocket close
   */
  ws.on('close', (code, reason) => {
    logger.info(`WebSocket closed: ${code} ${reason || '(no reason)'}`)
    proxy.cleanup()
    activeConnections.delete(sessionId)
    logger.info(`Active connections: ${activeConnections.size}`)
  })

  /**
   * Handle WebSocket errors
   */
  ws.on('error', (error) => {
    logger.error(`WebSocket error: ${error.message}`)
    proxy.cleanup()
    activeConnections.delete(sessionId)
  })
})

/**
 * Handle WebSocket server errors
 */
wss.on('error', (error) => {
  console.error('❌ WebSocket Server Error:', error.message)
})

/**
 * Start the server
 */
server.listen(PORT, HOST, () => {
  console.log('================================')
  console.log(`✅ Server running on ${HOST}:${PORT}`)
  console.log(`✅ WebSocket endpoint: ws://${HOST}:${PORT}/ws/terminal`)
  console.log(`✅ Health check: http://${HOST}:${PORT}/health`)
  console.log('================================')
  console.log('Waiting for connections...')
})

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('📪 SIGTERM received, shutting down gracefully...')
  
  // Close all active connections
  activeConnections.forEach((proxy, sessionId) => {
    console.log(`Closing connection: ${sessionId}`)
    proxy.cleanup()
  })
  activeConnections.clear()
  
  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed')
  })
  
  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\n📪 SIGINT received, shutting down...')
  process.exit(0)
})

// Log unhandled errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
})
