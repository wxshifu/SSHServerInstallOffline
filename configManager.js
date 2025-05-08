const vscode = require('vscode');

// 全局变量
let globalConfig = null;

// 配置管理类
class ConfigManager {
    static getConfig() {
        return globalConfig;
    }

    static updateConfig() {
        const config = vscode.workspace.getConfiguration('offlineserverinstall');
        globalConfig = {
            architectures: config.get('architectures'),
            operatingSystems: config.get('operatingSystems'),
            targetPath: config.get('targetPath'),
            autoUpdateServerFile: config.get('autoUpdateServerFile'),
            autoCleanFiles: config.get('autoCleanFiles')
        };
        return globalConfig;
    }

    static async updateTargetPath(newPath) {
        const config = vscode.workspace.getConfiguration('offlineserverinstall');
        await config.update('targetPath', newPath, vscode.ConfigurationTarget.Global);
        this.updateConfig();
    }
}

module.exports = ConfigManager; 