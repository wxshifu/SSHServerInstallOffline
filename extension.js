// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const https = require('https');
const SidebarViewProvider = require('./sidebarViewProvider');
const ConfigManager = require('./configManager');

// 全局变量
let productInfo = null;

// 初始化接口
class ExtensionInitializer {
	static async initialize() {
		try {
			// 初始化产品信息
			if (!initProductInfo()) {
				throw new Error('产品信息初始化失败');
			}

			// 初始化配置
			await this.initConfig();

			console.log('扩展初始化成功');
			return true;
		} catch (error) {
			vscode.window.showErrorMessage(`扩展初始化失败: ${error.message}`);
			return false;
		}
	}

	static async initConfig() {
		// 初始化全局配置
		ConfigManager.updateConfig();
		
		// 监听配置变化
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('offlineserverinstall')) {
				ConfigManager.updateConfig();
				console.log('配置已更新');
			}
		});
	}
}

// 下载管理器类
class DownloadManager {
	constructor(productInfo) {
		this.productInfo = productInfo;
	}

	// 检查文件是否存在
	checkFileExists(filePath) {
		return fs.existsSync(filePath);
	}

	// 清理目标文件夹中的无关文件
	async cleanTargetFolder(targetPath, filesToKeep) {
		try {
			const config = ConfigManager.getConfig();
			if (!config.autoCleanFiles) {
				console.log('自动清理已禁用，跳过清理步骤');
				return;
			}

			const files = fs.readdirSync(targetPath);
			for (const file of files) {
				const filePath = path.join(targetPath, file);
				const stats = fs.statSync(filePath);
				if (stats.isFile() && !filesToKeep.has(file)) {
					fs.unlinkSync(filePath);
					vscode.window.showInformationMessage(`已删除无关文件: ${file}`);
				}
			}
		} catch (error) {
			vscode.window.showErrorMessage(`清理文件夹失败: ${error.message}`);
			throw error;
		}
	}

	// VS Code 文件下载函数
	async downloadVSCodeFiles(targetPath, commitID, filesToKeep) {
		const baseUrl = 'https://vscode.download.prss.microsoft.com/dbazure/download/stable';
		const config = ConfigManager.getConfig();

		for (const os of config.operatingSystems) {
			for (const arch of config.architectures) {
				const fileUrl = `${baseUrl}/${commitID}/vscode-server-${os}-${arch}.tar.gz`;
				const filePath = path.join(targetPath, `${this.productInfo.nameShort}-${os}-${arch}-${commitID}.tar.gz`);
				console.log("VS Code 下载地址:" + fileUrl);

				if (this.checkFileExists(filePath)) {
					vscode.window.showInformationMessage(`文件已存在，跳过下载: ${filePath}`);
					filesToKeep.add(path.basename(filePath));
					continue;
				}

				try {
					await this.downloadSingleFile(fileUrl, filePath);
					filesToKeep.add(path.basename(filePath));
				} catch (error) {
					vscode.window.showErrorMessage(`下载 VS Code ${os}-${arch} 版本失败: ${error.message}`);
				}
			}
		}
	}

	// Cursor 文件下载函数
	async downloadCursorFiles(targetPath, commitID, version, filesToKeep) {
		const baseUrl = 'https://cursor.blob.core.windows.net/remote-releases';
		const config = ConfigManager.getConfig();

		for (const os of config.operatingSystems) {
			for (const arch of config.architectures) {
				const fileUrl = `${baseUrl}/${version}-${commitID}/vscode-reh-${os}-${arch}.tar.gz`;
				const filePath = path.join(targetPath, `${this.productInfo.nameShort}-${os}-${arch}-${commitID}.tar.gz`);
				console.log("Cursor 下载地址:" + fileUrl);
				vscode.window.showInformationMessage(`服务器下载:${os}-${arch}-Server`);

				if (this.checkFileExists(filePath)) {
					vscode.window.showInformationMessage(`文件已存在，跳过下载: ${filePath}`);
					filesToKeep.add(path.basename(filePath));
					continue;
				}

				try {
					await this.downloadSingleFile(fileUrl, filePath);
					filesToKeep.add(path.basename(filePath));
				} catch (error) {
					vscode.window.showErrorMessage(`下载 Cursor ${os}-${arch} 版本失败: ${error.message}`);
				}
			}
		}
	}

	// 单个文件下载函数
	downloadSingleFile(fileUrl, filePath) {
		return new Promise((resolve, reject) => {
			const file = fs.createWriteStream(filePath);
			
			https.get(fileUrl, (response) => {
				response.pipe(file);
				
				file.on('finish', () => {
					file.close();
					vscode.window.showInformationMessage(`文件已下载到: ${filePath}`);
					resolve();
				});
			}).on('error', (err) => {
				fs.unlink(filePath, () => {}); // 删除不完整的文件
				reject(err);
			});
		});
	}

	// 主下载函数
	async download(targetPath, commitID) {
		const config = ConfigManager.getConfig();

		if (config.operatingSystems.length === 0 || config.architectures.length === 0) {
			throw new Error('请至少选择一个远程服务器架构和操作系统');
		}

		// 创建要保留的文件名集合
		const filesToKeep = new Set();

		try {
			// 根据编辑器类型选择不同的下载逻辑
			if (this.productInfo.nameShort === 'Code') {
				await this.downloadVSCodeFiles(targetPath, commitID, filesToKeep);
			} else if (this.productInfo.nameShort === 'Cursor') {
				await this.downloadCursorFiles(targetPath, commitID, this.productInfo.version, filesToKeep);
			} else {
				throw new Error('不支持的编辑器类型(' + this.productInfo.nameShort + ')');
			}

			// 下载完成后清理文件夹
			await this.cleanTargetFolder(targetPath, filesToKeep);
		} catch (error) {
			vscode.window.showErrorMessage(`下载过程发生错误: ${error.message}`);
		}
	}
}

// ------------------------------------------------------------

function initProductInfo() {
	try {
		const appRoot = vscode.env.appRoot;
		const productJsonPath = path.join(appRoot, 'product.json');
		const rawData = fs.readFileSync(productJsonPath, 'utf-8');
		productInfo = JSON.parse(rawData);
		console.log("编辑器名称:" + productInfo.nameShort);
		console.log("编辑器ID:" + productInfo.id);
		return true;
	} catch (error) {
		vscode.window.showErrorMessage(`初始化编辑器信息失败: ${error.message}`);
		return false;
	}
}


function getCommitId() {
	try {
		return productInfo.commit;
	} catch (error) {
		vscode.window.showErrorMessage(`获取 Commit ID 失败: ${error.message}`);
		return null;
	}
}

// 检查服务器文件是否存在
async function checkServerFiles(targetPath, commitID) {
	const config = ConfigManager.getConfig();
	const missingFiles = [];
	const existingFiles = [];

	for (const os of config.operatingSystems) {
		for (const arch of config.architectures) {
			const filePath = path.join(targetPath, `${productInfo.nameShort}-${os}-${arch}-${commitID}.tar.gz`);
			if (fs.existsSync(filePath)) {
				existingFiles.push(path.basename(filePath));
			} else {
				missingFiles.push(path.basename(filePath));
			}
		}
	}

	return {
		missingFiles,
		existingFiles,
		allFilesExist: missingFiles.length === 0
	};
}

// 执行下载操作
async function executeDownload(targetPath, commitID, sidebarViewProvider) {
	try {
		sidebarViewProvider.updateStatus('开始下载文件...');
		const downloadManager = new DownloadManager(productInfo);
		await downloadManager.download(targetPath, commitID);
		
		// 下载完成后检查文件状态
		const fileStatus = await checkServerFiles(targetPath, commitID);
		if (fileStatus.allFilesExist) {
			sidebarViewProvider.updateStatus('所有服务器文件已就绪！');
		} else {
			sidebarViewProvider.updateStatus(`下载完成，但缺少以下文件：\n${fileStatus.missingFiles.join('\n')}`);
		}
	} catch (error) {
		vscode.window.showErrorMessage(`下载失败: ${error.message}`);
		sidebarViewProvider.updateStatus(`下载失败: ${error.message}`);
	}
}

// This method is called when your extension is activated
async function activate(context) {
	// 执行初始化
	const sidebarViewProvider = new SidebarViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('offlineserverinstall.view', sidebarViewProvider)
	);

	if (!await ExtensionInitializer.initialize()) {
		return;
	}

	console.log('Congratulations, your extension "offlineserverinstall" is now active!');
	const commitID = getCommitId();

	// 获取配置
	const config = ConfigManager.getConfig();

	// 如果启用了自动更新且有目标路径
	if (config.autoUpdateServerFile && config.targetPath) {
		await executeDownload(config.targetPath, commitID, sidebarViewProvider);
	}

	// 注册命令
	context.subscriptions.push(
		vscode.commands.registerCommand('offlineserverinstall.selectPath', async () => {
			const result = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: '选择目标路径'
			});

			if (result && result.length > 0) {
				const targetPath = result[0].fsPath;
				await ConfigManager.updateTargetPath(targetPath);
				sidebarViewProvider.updatePath(targetPath);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('offlineserverinstall.selectKey', async () => {
			const result = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: '选择私钥文件',
				filters: {
					'私钥文件': ['pem', 'key']
				}
			});

			if (result && result.length > 0) {
				const keyPath = result[0].fsPath;
				sidebarViewProvider._view.webview.postMessage({
					type: 'updateKeyPath',
					value: keyPath
				});
			}
		})
	);

	// 注册下载命令
	context.subscriptions.push(
		vscode.commands.registerCommand('offlineserverinstall.download', async () => {
			try {
				const config = ConfigManager.getConfig();
				const targetPath = config.targetPath;
				if (!targetPath) {
					vscode.window.showErrorMessage('请先设置目标路径');
					return;
				}

				await executeDownload(targetPath, commitID, sidebarViewProvider);
				sidebarViewProvider.updateStatus('下载完成！');
			} catch (error) {
				vscode.window.showErrorMessage(`下载失败: ${error.message}`);
				sidebarViewProvider.updateStatus(`下载失败: ${error.message}`);
			}
		})
	);

	const commitId_disposable = vscode.commands.registerCommand('getCommitId', () => {
		const commitId = getCommitId();
		console.log(commitId);
		sidebarViewProvider.updateStatus(`当前 Commit ID: ${commitId}`);
		return commitId;
	});

	context.subscriptions.push(commitId_disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}

