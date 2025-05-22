const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
const ConfigManager = require('./configManager');

class SidebarViewProvider {
    constructor(context) {
        this.context = context;
        this._view = null;
    }

    resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.context.extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // 监听侧边栏可见性变化
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.updateAllStatus();
                this.updateConfigToWebview();
            }
        });

        // 处理来自 webview 的消息
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'download':
                    await vscode.commands.executeCommand('sshserverinstalloffline.download');
                    break;
                case 'deleteFiles':
                    await this.deleteServerFiles();
                    break;
                case 'selectPath':
                    await vscode.commands.executeCommand('sshserverinstalloffline.selectPath');
                    break;
                case 'selectKey':
                    await vscode.commands.executeCommand('sshserverinstalloffline.selectKey');
                    break;
                case 'updatePath':
                    await this.updatePathInSettings(data.value);
                    break;
                case 'updateArchitectures':
                    await this.updateArchitectures(data.value);
                    break;
                case 'updateOperatingSystems':
                    await this.updateOperatingSystems(data.value);
                    break;
                case 'deploy':
                    await this.handleDeploy(data.value);
                    break;
            }
        });

        // 初始化时发送当前配置到 webview
        this.updateConfigToWebview();
    }

    // 更新所有状态
    async updateAllStatus() {
        // 更新路径状态
        this.updatePathFromConfig();

        // 获取配置和 Commit ID
        const config = ConfigManager.getConfig();
        const targetPath = config.targetPath;
        const commitID = await vscode.commands.executeCommand('getCommitId');

        // 如果设置了目标路径，检查文件状态
        if (targetPath) {
            const fileStatus = await this.checkServerFiles(targetPath, commitID);
            if (fileStatus.allFilesExist) {
                this.updateStatus('所有服务器文件已就绪！');
                console.log("更新状态，所有服务器文件已就绪！");
            } else {
                this.updateStatus(`缺少以下文件：\n${fileStatus.missingFiles.join('\n')}`);
                console.log("更新状态，但缺少以下文件：\n" + fileStatus.missingFiles.join('\n'));
            }
        }
    }

    // 从配置更新路径
    updatePathFromConfig() {
        const config = ConfigManager.getConfig();
        const targetPath = config.targetPath;
        
        if (!targetPath) {
            console.log('未设置目标路径');
            this.updatePath("");
        } else if (!fs.existsSync(targetPath)) {
            console.log(`目标路径不存在: ${targetPath}`);
            vscode.window.showWarningMessage(`目标路径不存在: ${targetPath}，请重新设置`);
        } else {
            this.updatePath(targetPath);
            console.log("目标路径已设置: " + targetPath);
        }
    }

    // 检查服务器文件状态
    async checkServerFiles(targetPath, commitID) {
        const config = ConfigManager.getConfig();
        const missingFiles = [];
        const existingFiles = [];
        console.log("检查服务器文件是否存在");
        for (const os of config.operatingSystems) {
            for (const arch of config.architectures) {
                const filePath = path.join(targetPath, `${this.getProductInfo().nameShort}-${os}-${arch}-${commitID}.tar.gz`);
                if (fs.existsSync(filePath)) {
                    existingFiles.push(path.basename(filePath));
                    console.log("文件存在: " + filePath);
                } else {
                    missingFiles.push(path.basename(filePath));
                    console.log("文件不存在: " + filePath);
                }
            }
        }
        if (this.getProductInfo().nameShort === 'Cursor') {
            for (const arch of config.architectures) {
            const filePath = path.join(targetPath, `${this.getProductInfo().nameShort}-cli-${arch}.tar.gz`);
            if (fs.existsSync(filePath)) {
                existingFiles.push(path.basename(filePath));
                console.log("Cursor-CLI 文件存在: " + filePath);
            } else {
                missingFiles.push(path.basename(filePath));
                console.log("Cursor-CLI 文件不存在: " + filePath);
            }
            }
        }else if (this.getProductInfo().nameShort === 'Code') {
            for (const arch of config.architectures) {
                const filePath = path.join(targetPath, `${this.getProductInfo().nameShort}-cli-${arch}.tar.gz`);
                if (fs.existsSync(filePath)) {
                    existingFiles.push(path.basename(filePath));
                    console.log("VS Code-CLI 文件存在: " + filePath);
                } else {
                    missingFiles.push(path.basename(filePath));
                    console.log("VS Code-CLI 文件不存在: " + filePath);
                }
            }
        }
    
        return {
            missingFiles,
            existingFiles,
            allFilesExist: missingFiles.length === 0
        };
    }

    // 获取产品信息
    getProductInfo() {
        try {
            const appRoot = vscode.env.appRoot;
            const productJsonPath = path.join(appRoot, 'product.json');
            const rawData = fs.readFileSync(productJsonPath, 'utf-8');
            return JSON.parse(rawData);
        } catch (error) {
            console.error('获取产品信息失败:', error);
            return { nameShort: 'Unknown' };
        }
    }

    // 更新设置中的路径
    async updatePathInSettings(newPath) {
        try {
            await ConfigManager.updateTargetPath(newPath);
            this.updateStatus('目标路径已更新！');
        } catch (error) {
            vscode.window.showErrorMessage(`更新路径失败: ${error.message}`);
            this.updateStatus(`更新路径失败: ${error.message}`);
        }
    }

    _getHtmlForWebview(webview) {
        return `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        padding: 20px;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 12px;
                        margin: 5px 0;
                        cursor: pointer;
                        width: 100%;
                        text-align: left;
                    }
                    .button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .status {
                        margin-top: 0px;
                        padding: 30px;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .section {
                        margin-top: 20px;
                        padding-top: 10px;
                        border-top: 1px solid var(--vscode-panel-border);
                    }
                    .section-title {
                        font-size: 14px;
                        font-weight: bold;
                        margin-bottom: 10px;
                        color: var(--vscode-foreground);
                    }
                    .path-preview {
                        margin: 10px 0;
                        padding: 8px;
                        background-color: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 2px;
                        word-break: break-all;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 12px;
                        cursor: pointer;
                    }
                    .path-preview:hover {
                        background-color: var(--vscode-editor-hoverHighlightBackground);
                    }
                    .input-group {
                        margin: 10px 0;
                    }
                    .input-group label {
                        display: block;
                        margin-bottom: 5px;
                        color: var(--vscode-foreground);
                    }
                    .input-group input {
                        width: 100%;
                        padding: 6px;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 2px;
                    }
                    .input-group input:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                    }
                    .auth-method {
                        margin: 10px 0;
                    }
                    .auth-method label {
                        margin-right: 15px;
                        color: var(--vscode-foreground);
                    }
                    .auth-method input[type="radio"] {
                        margin-right: 5px;
                    }
                    .key-path {
                        margin-top: 10px;
                    }
                    .checkbox-group {
                        margin: 10px 0;
                    }
                    .checkbox-group label {
                        display: block;
                        margin: 5px 0;
                        color: var(--vscode-foreground);
                    }
                    .checkbox-group input[type="checkbox"] {
                        margin-right: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="status" id="status"></div>

                <div class="section">
                    <div class="section-title">路径设置</div>
                    <div class="path-preview" id="pathPreview" title="点击复制路径">未设置目标路径</div>
                    <button class="button" id="selectPath">选择目标路径</button>
                </div>

                <div class="section">
                    <div class="section-title">服务器架构设置</div>
                    <div class="checkbox-group" id="architectures">
                        <label>
                            <input type="checkbox" name="arch" value="x64"> x64
                        </label>
                        <label>
                            <input type="checkbox" name="arch" value="arm64"> arm64
                        </label>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">服务器操作系统设置</div>
                    <div class="checkbox-group" id="operatingSystems">
                        <label>
                            <input type="checkbox" name="os" value="linux"> Linux
                        </label>
                        <label>
                            <input type="checkbox" name="os" value="darwin"> macOS
                        </label>
                        <label>
                            <input type="checkbox" name="os" value="win32"> Windows
                        </label>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">基本操作</div>
                    <button class="button" id="download">下载离线服务器文件</button>
                    <button class="button" id="deleteFiles" style="background-color: var(--vscode-errorForeground);">删除已下载文件</button>
                </div>

                <div class="section">
                    <div class="section-title">服务器部署</div>
                    <div class="input-group">
                        <label for="sshHost">SSH 地址</label>
                        <input type="text" id="sshHost" placeholder="例如：192.168.1.100">
                    </div>
                    <div class="input-group">
                        <label for="sshUser">用户名</label>
                        <input type="text" id="sshUser" placeholder="例如：root">
                    </div>
                    <div class="auth-method">
                        <label>
                            <input type="radio" name="authMethod" value="password" checked> 密码认证
                        </label>
                        <label>
                            <input type="radio" name="authMethod" value="key"> 密钥认证
                        </label>
                    </div>
                    <div id="passwordAuth" class="input-group">
                        <label for="sshPassword">密码</label>
                        <input type="password" id="sshPassword" placeholder="输入密码">
                    </div>
                    <div id="keyAuth" class="input-group" style="display: none;">
                        <label for="privateKeyPath">私钥路径</label>
                        <div class="key-path">
                            <input type="text" id="privateKeyPath" placeholder="选择私钥文件" readonly>
                            <button class="button" id="selectKey">选择私钥</button>
                        </div>
                        <label for="keyPassphrase">密钥密码（如果有）</label>
                        <input type="password" id="keyPassphrase" placeholder="输入密钥密码（可选）">
                    </div>
                    <button class="button" id="deploy">部署到服务器</button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                                        // 监听来自扩展的消息
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'status':
                                document.getElementById('status').textContent = message.value;
                                break;
                            case 'updatePath':
                                document.getElementById('pathPreview').textContent = message.value;
                                break;
                            case 'updateKeyPath':
                                document.getElementById('privateKeyPath').value = message.value;
                                break;
                            case 'updateConfig':
                                // 更新架构选择
                                message.value.architectures.forEach(arch => {
                                    const checkbox = document.querySelector('input[name="arch"][value="' + arch + '"]');
                                    if (checkbox) checkbox.checked = true;
                                });
                                // 更新系统选择
                                message.value.operatingSystems.forEach(os => {
                                    const checkbox = document.querySelector('input[name="os"][value="' + os + '"]');
                                    if (checkbox) checkbox.checked = true;
                                });
                                break;
                        }
                    });
                    
                    // 认证方式切换
                    document.querySelectorAll('input[name="authMethod"]').forEach(radio => {
                        radio.addEventListener('change', (e) => {
                            const passwordAuth = document.getElementById('passwordAuth');
                            const keyAuth = document.getElementById('keyAuth');
                            if (e.target.value === 'password') {
                                passwordAuth.style.display = 'block';
                                keyAuth.style.display = 'none';
                            } else {
                                passwordAuth.style.display = 'none';
                                keyAuth.style.display = 'block';
                            }
                        });
                    });

                    // 架构选择
                    document.querySelectorAll('input[name="arch"]').forEach(checkbox => {
                        checkbox.addEventListener('change', () => {
                            const selectedArchs = Array.from(document.querySelectorAll('input[name="arch"]:checked'))
                                .map(cb => cb.value);
                            if (selectedArchs.length === 0) {
                                checkbox.checked = true;
                                vscode.postMessage({
                                    type: 'status',
                                    value: '至少需要选择一个架构'
                                });
                                return;
                            }
                            // 确保没有重复的选项
                            const uniqueArchs = [...new Set(selectedArchs)];
                            vscode.postMessage({
                                type: 'updateArchitectures',
                                value: uniqueArchs
                            });
                        });
                    });

                    // 系统选择
                    document.querySelectorAll('input[name="os"]').forEach(checkbox => {
                        checkbox.addEventListener('change', () => {
                            const selectedOS = Array.from(document.querySelectorAll('input[name="os"]:checked'))
                                .map(cb => cb.value);
                            if (selectedOS.length === 0) {
                                checkbox.checked = true;
                                vscode.postMessage({
                                    type: 'status',
                                    value: '至少需要选择一个系统'
                                });
                                return;
                            }
                            // 确保没有重复的选项
                            const uniqueOS = [...new Set(selectedOS)];
                            vscode.postMessage({
                                type: 'updateOperatingSystems',
                                value: uniqueOS
                            });
                        });
                    });

                    // 选择私钥文件
                    document.getElementById('selectKey').addEventListener('click', () => {
                        vscode.postMessage({
                            type: 'selectKey'
                        });
                    });

                    document.getElementById('download').addEventListener('click', () => {
                        vscode.postMessage({
                            type: 'download'
                        });
                    });

                    document.getElementById('deleteFiles').addEventListener('click', () => {
                        vscode.postMessage({
                            type: 'deleteFiles'
                        });
                    });

                    document.getElementById('selectPath').addEventListener('click', () => {
                        vscode.postMessage({
                            type: 'selectPath'
                        });
                    });

                    document.getElementById('deploy').addEventListener('click', () => {
                        const host = document.getElementById('sshHost').value;
                        const user = document.getElementById('sshUser').value;
                        const authMethod = document.querySelector('input[name="authMethod"]:checked').value;
                        
                        if (!host || !user) {
                            vscode.postMessage({
                                type: 'status',
                                value: '请填写完整的 SSH 连接信息'
                            });
                            return;
                        }

                        const config = {
                            host,
                            user,
                            authMethod
                        };

                        if (authMethod === 'password') {
                            const password = document.getElementById('sshPassword').value;
                            if (!password) {
                                vscode.postMessage({
                                    type: 'status',
                                    value: '请输入密码'
                                });
                                return;
                            }
                            config.password = password;
                        } else {
                            const privateKeyPath = document.getElementById('privateKeyPath').value;
                            if (!privateKeyPath) {
                                vscode.postMessage({
                                    type: 'status',
                                    value: '请选择私钥文件'
                                });
                                return;
                            }
                            config.privateKeyPath = privateKeyPath;
                            config.passphrase = document.getElementById('keyPassphrase').value;
                        }

                        vscode.postMessage({
                            type: 'deploy',
                            value: config
                        });
                    });

                    // 点击路径预览时复制路径
                    document.getElementById('pathPreview').addEventListener('click', () => {
                        const path = document.getElementById('pathPreview').textContent;
                        if (path !== '未设置目标路径') {
                            navigator.clipboard.writeText(path).then(() => {
                                vscode.postMessage({
                                    type: 'status',
                                    value: '路径已复制到剪贴板'
                                });
                            });
                        }
                    });

                </script>
            </body>
            </html>
        `;
    }

    // 更新状态信息
    updateStatus(message) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'status',
                value: message
            });
        }
    }

    // 更新路径预览
    updatePath(path) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updatePath',
                value: path || '未设置目标路径'
            });
        }
    }

    // 处理 SSH 部署
    async handleDeploy(sshConfig) {
        let conn = null;
        try {
            const config = ConfigManager.getConfig();
            const targetPath = config.targetPath;
            const commitID = await vscode.commands.executeCommand('getCommitId');
            const productInfo = this.getProductInfo();

            if (!targetPath) {
                this.updateStatus('请先设置目标路径');
                return;
            }

            this.updateStatus('正在连接服务器...');
            vscode.window.showInformationMessage('正在连接服务器...');
            conn = new Client();

            // 准备 SSH 配置
            const sshOptions = {
                host: sshConfig.host,
                username: sshConfig.user
            };

            // 根据认证方式设置认证信息
            if (sshConfig.authMethod === 'password') {
                sshOptions.password = sshConfig.password;
            } else {
                try {
                    sshOptions.privateKey = fs.readFileSync(sshConfig.privateKeyPath);
                    if (sshConfig.passphrase) {
                        sshOptions.passphrase = sshConfig.passphrase;
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`读取私钥文件失败: ${error.message}`);
                    throw new Error(`读取私钥文件失败: ${error.message}`);
                    
                }
            }

            await new Promise((resolve, reject) => {
                conn.on('ready', () => {
                    this.updateStatus('已连接到服务器，开始上传文件...');
                    vscode.window.showInformationMessage('已连接到服务器，开始上传文件...');
                    console.log('开始上传文件...');
                    console.log(targetPath);
                    this.uploadAndDeployFiles(conn, targetPath, commitID, productInfo)
                        .then(resolve)
                        .catch(reject);
                }).on('error', (err) => {
                    vscode.window.showErrorMessage(`SSH 连接失败: ${err.message}`);
                    reject(new Error(`SSH 连接失败: ${err.message}`));
                }).connect(sshOptions);
            });

            this.updateStatus('部署完成！如果无法连接，请尝试删除服务器和CLI文件，重新下载并部署！');
            vscode.window.showInformationMessage('部署完成！如果无法连接，请尝试删除服务器和CLI文件，重新下载并部署！');
        } catch (error) {
            this.updateStatus(`部署失败: ${error.message}`);
            vscode.window.showErrorMessage(`部署失败: ${error.message}`);
        } finally {
            if (conn) {
                conn.end();
                conn = null;
            }
        }
    }

    // 上传并部署文件
    async uploadAndDeployFiles(conn, targetPath, commitID, productInfo) {
        const isCursor = productInfo.nameShort === 'Cursor';
        const isVSCode = productInfo.nameShort === 'Code';
        
        // 获取用户主目录
        const homeDir = await this.execCommand(conn, 'echo $HOME');
        const remoteBasePath = isCursor ? 
            `${homeDir}/.cursor-server` : 
            `${homeDir}/.vscode-server`;

        // 获取远程系统信息
        const os = await this.getOS(conn);
        const arch = await this.getArch(conn);
        console.log("os: " + os + " arch: " + arch);
        console.log("远程基础路径: " + remoteBasePath);

        const serverPath = isCursor ? 
            `${remoteBasePath}/cursor-${commitID}` :
            `${remoteBasePath}/vscode-server`;

        // 创建远程目录
        await this.execCommand(conn, `mkdir -p ${remoteBasePath}`);

            await this.execCommand(conn, `mkdir -p ${remoteBasePath}/cli/servers/Stable-${commitID}/server`);
            console.log("创建远程目录成功");


        // 上传服务器文件
        const serverFile = path.join(targetPath, `${productInfo.nameShort}-${os}-${arch}-${commitID}.tar.gz`);
        if (fs.existsSync(serverFile)) {
            console.log("服务器文件存在: " + serverFile);
            console.log("准备上传到: " + serverPath + ".tar.gz");
            await this.uploadFile(conn, serverFile, serverPath + ".tar.gz");
            console.log("服务器文件上传成功");
        } else {
            throw new Error(`服务器文件不存在: ${serverFile}`);
        }
        if (isCursor) {
            const cliFile = path.join(targetPath, `${productInfo.nameShort}-cli-${arch}.tar.gz`);
            if (fs.existsSync(cliFile)) {
                console.log("Cursor-CLI 文件存在: " + cliFile);
                console.log("准备上传到: " + serverPath);
                await this.uploadFile(conn, cliFile, serverPath);
                console.log("Cursor-CLI 文件上传成功");
            } else {
                throw new Error(`Cursor-CLI 文件不存在: ${cliFile}`);
            }
        } else if (isVSCode) {
            const cliFile = path.join(targetPath, `${productInfo.nameShort}-cli-${arch}.tar.gz`);
            if (fs.existsSync(cliFile)) {
                console.log("VS Code-CLI 文件存在: " + cliFile);
                console.log("准备上传到: " + serverPath);
                await this.uploadFile(conn, cliFile, serverPath);
                console.log("VS Code-CLI 文件上传成功");
            } else {
                throw new Error(`VS Code-CLI 文件不存在: ${cliFile}`);
            }
        }

        // 解压文件
        if (isCursor) {
            await this.execCommand(conn, `cd ${remoteBasePath} && tar -xzf ${serverPath}.tar.gz -C ${remoteBasePath}/cli/servers/Stable-${commitID}/server --strip-components 1 && rm -rf ${serverPath}.tar.gz`);
            console.log("Cursor-Server 解压成功");
            await this.execCommand(conn, `cd ${remoteBasePath} && tar -xzf ${serverPath} -C ${remoteBasePath}/ && rm -rf ${serverPath} && mv ./cursor  ./cursor-${commitID}`);
            console.log("Cursor-Server-CLI 解压成功");
        } else if (isVSCode) {
            await this.execCommand(conn, `cd ${remoteBasePath} && tar -xzf ${serverPath}.tar.gz -C ${remoteBasePath}/cli/servers/Stable-${commitID}/server --strip-components 1 && rm -rf ${serverPath}.tar.gz`);
            console.log("VSCode-Server 解压成功");
            await this.execCommand(conn, `cd ${remoteBasePath} && tar -xzf ${serverPath} -C ${remoteBasePath}/ && rm -rf ${serverPath} && mv ./code  ./code-${commitID}`);
            console.log("VSCode-Server-CLI 解压成功");
        }
    }

    // 获取操作系统信息
    async getOS(conn) {
        const os = await this.execCommand(conn, 'uname -s');
        if (os === 'Linux') {
            return 'linux';
        } else if (os === 'Darwin') {
            return 'darwin';
        } else if (os === 'Windows') {
            return 'win32';
        } else {
            return 'unknown';
        }
    }
    
    // 获取架构信息
    async getArch(conn) {
        const arch = await this.execCommand(conn, 'uname -m');
        if (arch === 'x86_64') {
            return 'x64';
        } else if (arch === 'aarch64' || arch === 'arm64') {
            return 'arm64';
        } else {
            return 'unknown';
        }
    }

    // 执行远程命令
    execCommand(conn, command) {
        return new Promise((resolve, reject) => {
            conn.exec(command, (err, stream) => {
                if (err) reject(err);
                let output = '';
                stream.on('data', (data) => {
                    output += data.toString();
                })
                .on('close', () => {
                    resolve(output.trim());
                })
                .stderr.on('data', (data) => {
                    console.error(data.toString());
                });
            });
        });
    }

    // 上传文件
    uploadFile(conn, localPath, remotePath) {
        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) reject(err);
                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    // 更新架构设置
    async updateArchitectures(architectures) {
        try {
            const config = vscode.workspace.getConfiguration('sshserverinstalloffline');
            await config.update('architectures', architectures, vscode.ConfigurationTarget.Global);
            ConfigManager.updateConfig();
            this.updateStatus('架构设置已更新！');
        } catch (error) {
            vscode.window.showErrorMessage(`更新架构设置失败: ${error.message}`);
            this.updateStatus(`更新架构设置失败: ${error.message}`);
        }
    }

    // 更新系统设置
    async updateOperatingSystems(operatingSystems) {
        try {
            const config = vscode.workspace.getConfiguration('sshserverinstalloffline');
            await config.update('operatingSystems', operatingSystems, vscode.ConfigurationTarget.Global);
            ConfigManager.updateConfig();
            this.updateStatus('系统设置已更新！');
        } catch (error) {
            vscode.window.showErrorMessage(`更新系统设置失败: ${error.message}`);
            this.updateStatus(`更新系统设置失败: ${error.message}`);
        }
    }

    // 更新配置到 webview
    updateConfigToWebview() {
        if (this._view) {
            const config = ConfigManager.getConfig();
            this._view.webview.postMessage({
                type: 'updateConfig',
                value: {
                    architectures: config.architectures,
                    operatingSystems: config.operatingSystems
                }
            });
        }
    }

    // 删除服务器文件
    async deleteServerFiles() {
        try {
            const config = ConfigManager.getConfig();
            const targetPath = config.targetPath;
            const commitID = await vscode.commands.executeCommand('getCommitId');
            const productInfo = this.getProductInfo();

            if (!targetPath) {
                this.updateStatus('请先设置目标路径');
                return;
            }

            // 确认删除
            const confirm = await vscode.window.showWarningMessage(
                '确定要删除所有已下载的服务器文件吗？',
                { modal: true },
                '确定'
            );

            if (confirm !== '确定') {
                return;
            }

            let deletedCount = 0;
            for (const os of config.operatingSystems) {
                for (const arch of config.architectures) {
                    const filePath = path.join(targetPath, `${productInfo.nameShort}-${os}-${arch}-${commitID}.tar.gz`);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            }

            if (deletedCount > 0) {
                this.updateStatus(`已删除 ${deletedCount} 个服务器文件`);
                vscode.window.showInformationMessage(`已删除 ${deletedCount} 个服务器文件`);
            } else {
                this.updateStatus('没有找到需要删除的文件');
            }
        } catch (error) {
            this.updateStatus(`删除文件失败: ${error.message}`);
            vscode.window.showErrorMessage(`删除文件失败: ${error.message}`);
        }
    }
}

module.exports = SidebarViewProvider; 
