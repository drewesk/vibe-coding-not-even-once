/**
 * SSH Proxy Manager
 * 
 * Handles WebSocket <-> SSH bidirectional communication
 * Manages SSH client connections to Linode VMs
 */

import { Client } from 'ssh2'
import { readFileSync, existsSync } from 'fs'
import { getVMConfig } from './vmConfig.js'

export class SSHProxy {
  constructor(ws, vmId, logger) {
    this.ws = ws
    this.vmId = vmId
    this.logger = logger
    this.sshClient = null
    this.stream = null
    this.isConnecting = false
    this.isConnected = false
  }

  /**
   * Establish SSH connection to VM
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnecting || this.isConnected) {
      this.logger.warn('Already connecting or connected')
      return
    }

    this.isConnecting = true
    const config = getVMConfig(this.vmId)
    this.logger.info(`Connecting to ${this.vmId} at ${config.host}:${config.port}`)

    return new Promise((resolve, reject) => {
      this.sshClient = new Client()

      this.sshClient.on('ready', () => {
        this.logger.info(`SSH connection established to ${this.vmId}`)
        this.isConnecting = false
        this.isConnected = true

        // Request interactive shell with proper terminal
        this.sshClient.shell({
          term: 'xterm-256color',
          cols: 80,
          rows: 24
        }, (err, stream) => {
          if (err) {
            this.logger.error(`Shell request error: ${err.message}`)
            this.isConnected = false
            return reject(err)
          }

          this.stream = stream
          this.logger.info('Interactive shell session opened')

          // SSH stdout -> WebSocket
          stream.on('data', (data) => {
            if (this.ws.readyState === 1) { // WebSocket.OPEN
              try {
                this.ws.send(data)
              } catch (error) {
                this.logger.error(`WebSocket send error: ${error.message}`)
              }
            }
          })

          // SSH stderr -> WebSocket
          stream.stderr.on('data', (data) => {
            if (this.ws.readyState === 1) {
              try {
                this.ws.send(data)
              } catch (error) {
                this.logger.error(`WebSocket send error (stderr): ${error.message}`)
              }
            }
          })

          // Handle stream close
          stream.on('close', () => {
            this.logger.info(`SSH stream closed for ${this.vmId}`)
            this.isConnected = false
            this.cleanup()
          })

          // Handle stream errors
          stream.on('error', (err) => {
            this.logger.error(`SSH stream error: ${err.message}`)
            this.isConnected = false
          })

          resolve()
        })
      })

      this.sshClient.on('error', (err) => {
        this.logger.error(`SSH client error: ${err.message}`)
        this.isConnecting = false
        this.isConnected = false
        reject(err)
      })

      this.sshClient.on('close', () => {
        this.logger.info(`SSH connection closed for ${this.vmId}`)
        this.isConnected = false
        this.isConnecting = false
      })

      this.sshClient.on('end', () => {
        this.logger.info(`SSH connection ended for ${this.vmId}`)
        this.isConnected = false
      })

      // Read SSH private key
      let privateKey
      try {
        if (!existsSync(config.privateKeyPath)) {
          throw new Error(`SSH private key not found at: ${config.privateKeyPath}`)
        }
        privateKey = readFileSync(config.privateKeyPath, 'utf8')
        this.logger.info(`Loaded SSH key from ${config.privateKeyPath}`)
      } catch (error) {
        this.logger.error(`Failed to read SSH key: ${error.message}`)
        this.isConnecting = false
        return reject(error)
      }

      // Establish SSH connection
      try {
        this.sshClient.connect({
          host: config.host,
          port: config.port,
          username: config.username,
          privateKey: privateKey,
          readyTimeout: 30000,
          keepaliveInterval: 10000,
          keepaliveCountMax: 3,
          // Accept any host key (for test environments)
          // In production, you should verify host keys
          hostVerifier: () => true,
          algorithms: {
            serverHostKey: ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'rsa-sha2-256', 'rsa-sha2-512']
          }
        })
      } catch (error) {
        this.logger.error(`SSH connect error: ${error.message}`)
        this.isConnecting = false
        reject(error)
      }
    })
  }

  /**
   * Send input data to SSH session
   * @param {string|Buffer} data - Input data from WebSocket
   */
  handleInput(data) {
    if (!this.stream || !this.stream.writable) {
      this.logger.warn('Cannot send input - stream not writable')
      return
    }

    try {
      this.stream.write(data)
    } catch (error) {
      this.logger.error(`Stream write error: ${error.message}`)
    }
  }

  /**
   * Handle terminal resize
   * @param {number} rows - Terminal rows
   * @param {number} cols - Terminal columns
   */
  handleResize(rows, cols) {
    if (!this.stream) {
      this.logger.warn('Cannot resize - no active stream')
      return
    }

    try {
      this.stream.setWindow(rows, cols)
      this.logger.info(`Terminal resized to ${cols}x${rows}`)
    } catch (error) {
      this.logger.error(`Resize error: ${error.message}`)
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.logger.info('Cleaning up SSH proxy resources')

    if (this.stream) {
      try {
        this.stream.end()
      } catch (error) {
        this.logger.error(`Stream end error: ${error.message}`)
      }
      this.stream = null
    }

    if (this.sshClient) {
      try {
        this.sshClient.end()
      } catch (error) {
        this.logger.error(`SSH client end error: ${error.message}`)
      }
      this.sshClient = null
    }

    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.close()
      } catch (error) {
        this.logger.error(`WebSocket close error: ${error.message}`)
      }
    }

    this.isConnected = false
    this.isConnecting = false
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isActive() {
    return this.isConnected && this.stream && this.stream.writable
  }
}
