# Student TUI with Real VM Access

Interactive terminal-based learning environment with access to real Linux VMs.

## Features

### Story Mode (Original)
- Guided tutorials for learning AI agent concepts
- Step-by-step progression
- Interactive command practice

### Base Mode (Original)
- Simulated Unix command practice
- File system operations
- Command history and autocomplete

### VM Mode (NEW) ⭐
- **Real SSH access to Linux VMs**
- **Live coding environment**
- **Full Node.js, Python, and Git support**
- **AI assistance with OpenCode CLI**
- **Collaborative pairing on shared VMs**

## Quick Start

### For Students

```
1. Visit: https://dinenyc.io
2. Type: mode vm
3. Type: connect vm1
4. Start coding!
```

### For Instructors

See `docs/QUICKSTART.md` for 30-minute setup guide.

## Architecture

```
Student Browser
  ↓ HTTPS/WebSocket
Hostinger (DineNYC.io)
  ├─ Frontend (React + xterm.js)
  └─ Backend (Node.js SSH Proxy)
      ↓ SSH
Linode VMs (Ubuntu 22.04)
  ├─ Node.js 20
  ├─ Python 3.11
  ├─ OpenCode CLI
  └─ Git (pre-configured)
```

## What's Included

- ✅ **Frontend VM Mode** - Terminal UI with SSH client
- ✅ **Backend SSH Proxy** - WebSocket-to-SSH bridge
- ✅ **Golden VM Script** - Automated VM setup
- ✅ **4 Test VMs** - Ready to provision
- ✅ **Complete Documentation** - Deployment guides
- ✅ **Helper Scripts** - Management tools

## Files Structure

```
student_TUI_demo/
├── server/              # Backend SSH proxy
├── scripts/             # VM setup and management
├── docs/                # Documentation
├── src/                 # Frontend (React)
└── dist/                # Built frontend
```

## Documentation

- **Quick Start**: `docs/QUICKSTART.md` - Fast 30-min setup
- **Full Guide**: `docs/hostinger-deployment.md` - Complete deployment
- **Backend**: `server/README.md` - Backend documentation
- **Summary**: `IMPLEMENTATION_SUMMARY.md` - What's been built

## Technology

- **Frontend**: React 19 + TypeScript + xterm.js
- **Backend**: Node.js + Express + WebSocket + ssh2
- **VMs**: Ubuntu 22.04 + Node.js 20 + Python 3.11
- **Hosting**: Hostinger (DineNYC.io)
- **VMs**: Linode Nanodes ($5/month each)

## Setup Overview

1. Generate SSH keys
2. Create golden VM on Linode
3. Run setup script
4. Create snapshot
5. Clone 4 VMs
6. Update VM IPs in config
7. Deploy backend to Hostinger
8. Configure NGINX
9. Test end-to-end

**Time**: ~30 minutes  
**Cost**: $0-1 (with Linode free credits)

## Usage

### Switch Modes
```
mode story    # Tutorial mode
mode base     # Command practice
mode vm       # Real VM access
```

### Connect to VM
```
connect vm1   # Connect to VM 1
connect vm2   # Connect to VM 2
# etc.
```

### Disconnect
```
exit          # Disconnect from VM
```

### Available on VM
- `node` - Run JavaScript
- `python3` - Run Python
- `git` - Version control (pre-configured)
- `opencode` - AI coding assistant
- `npm` - Node package manager
- `pip` - Python package manager

## Cost

- **Testing**: $0-1 (2 days with free credits)
- **Per class**: ~$0.33 (spin up/down VMs)
- **1 month**: ~$20 (4 VMs always on)

## VM Assignments

For a class of 8-16 students:
- **Pairs 1-2**: VM1
- **Pairs 3-4**: VM2
- **Pairs 5-6**: VM3
- **Pairs 7-8**: VM4

Multiple students can share a VM (collaborative)

## Support

Check logs:
```bash
pm2 logs student-ssh-proxy
```

Test SSH:
```bash
ssh -i ~/.ssh/student_vms student@VM_IP
```

Health check:
```bash
curl http://localhost:3001/health
```

See troubleshooting in `docs/hostinger-deployment.md`

## Development

```bash
# Install dependencies
npm install
cd server && npm install

# Run frontend dev server
npm run dev

# Run backend dev server
cd server && npm run dev

# Build frontend
npm run build
```

## License

MIT

## Credits

Built for NYC Tech Meetup coding workshops.
