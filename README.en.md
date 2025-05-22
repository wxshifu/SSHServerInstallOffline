# 🚀 SSH Server Install Offline

<div align="center">

[![VS Code Version](https://img.shields.io/badge/VS%20Code-1.85.0+-blue)](https://code.visualstudio.com/)
[![Node.js Version](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/supshifu/offlineserverinstall/blob/main/LICENSE)

> ⚠️ **Note**: This English version is AI-generated. Any translation inaccuracies do not represent the author's original intent. For the most accurate information, please refer to the [Chinese version](./README.md).

A powerful VS Code extension for offline installation and management of VS Code/Cursor remote servers.

[English](./README.en.md) | [简体中文](./README.md)

</div>

## ✨ Features

- 🖥️ **Multi-platform Support**
  - Multiple architectures (x64, arm64)
  - Multiple operating systems (Linux, macOS, Windows)
  - Automatic server architecture and OS detection

- 🔄 **Offline Deployment**
  - Offline download of VS Code/Cursor remote server files
  - Graphical interface for server deployment
  - Batch download and deployment support

- 🔐 **Security Authentication**
  - SSH password authentication
  - SSH key authentication
  - Key passphrase protection

## 📋 System Requirements

- **VS Code**: 1.85.0 or higher
- **Node.js**: 20.x or higher
- **Operating Systems**:
  - Windows 10/11
  - macOS 10.15+
  - Linux (major distributions)

## 🚀 Quick Start

1. **Install Extension**
   - Search for "SSH Server Install Offline" in VS Code marketplace
   - Click install

2. **Configure Settings**
   - Find "Offline Server Install" icon in VS Code sidebar
   - Set target path
   - Select required architectures and operating systems

3. **Download Files**
   - Click "Download Offline Server Files"
   - Wait for download to complete

4. **Deploy Server**
   - Configure SSH connection information
   - Click "Deploy to Server"
   - Wait for deployment to complete

## ⚙️ Configuration

### Architecture Settings
```jsonc
{
  "offlineserverinstall.architectures": [
    "x64",    // Intel/AMD 64-bit architecture
    "arm64"   // ARM 64-bit architecture
  ]
}
```

### Operating System Settings
```jsonc
{
  "offlineserverinstall.operatingSystems": [
    "linux",  // Linux systems
    "darwin", // macOS systems
    "win32"   // Windows systems
  ]
}
```

### Target Path
```jsonc
{
  "offlineserverinstall.targetPath": "./Server"  // Server files storage path
}
```

### Auto Update
```jsonc
{
  "offlineserverinstall.autoUpdateServerFile": false  // Auto update server files
}
```

### Auto Clean
```jsonc
{
  "offlineserverinstall.autoCleanFiles": false  // Auto clean unused files
}
```

## 💻 Development

### Environment Setup
```bash
# Clone repository
git clone https://github.com/yourusername/sshserverinstalloffline.git

# Install dependencies
npm install

# Run tests
npm test

# Package extension
vsce package
```

### Project Structure
```
.
├── extension.js          # Extension entry file
├── sidebarViewProvider.js # Sidebar view provider
├── configManager.js      # Configuration manager
├── resources/           # Resource files
│   ├── icon.png        # Extension icon
│   └── dark/          # Dark theme resources
│       └── install.png # Sidebar icon
└── package.json        # Project configuration
```

## 🛠️ Tech Stack

- **VS Code Extension API**: Extension development framework
- **Node.js**: Runtime environment
- **SSH2**: SSH connection and file transfer
- **HTML/CSS/JavaScript**: WebView interface development

## 🤝 Contributing

Issues and Pull Requests are welcome! Before submitting, please ensure:

1. Update test cases
2. Update documentation
3. Follow code style guidelines

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/supshifu/offlineserverinstall/blob/main/LICENSE) file for details

---

<div align="center">

**SSH Server Install Offline** ©2024 Created by [ShiFu](https://github.com/supshifu)

</div> 