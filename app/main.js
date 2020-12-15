// Modules to control application life and create native browser window
const { app, ipcMain, dialog, BrowserWindow, Menu, MenuItem, shell, screen } = require("electron");

let length;

function createPanel() {

	const mainWindow = new BrowserWindow({
		width         : 600,
		minWidth      : 600,
		height        : screen.getPrimaryDisplay().workAreaSize.height,
		minHeight     : 600,
		fullscreenable: false,
		title         : "Mimi Downloader",
		webPreferences: {
			nodeIntegration : true,
			contextIsolation: false
		}
	});

	mainWindow.loadFile("app/panel.html");

	mainWindow.webContents.on("did-finish-load", () => {
		mainWindow.webContents.send("default-path", app.getPath("downloads") || __dirname);
	});

	//mainWindow.setPosition(0, 0, true);

	// Open the DevTools.
	//mainWindow.webContents.openDevTools();

	mainWindow.on("close", (e) => {
		//e.preventDefault();
		const options = {
			type   : "warning",
			title  : "[Warning]",
			message: "资源正在下载，您确定要强制退出吗？",
			buttons: ["是", "否"]
		};
		if (length && dialog.showMessageBoxSync(options)) e.preventDefault();
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
	createPanel();

	app.on("activate", () => {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) createPanel();
	});
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	//if (process.platform !== "darwin") app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on("length", (event, message) => {
	length = message;
});

process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = true;

// https://www.zhihu.com/question/51598623/answer/279834636
ipcMain.on("show-context-menu", (event) => {
	let menu = new Menu(); //new一个菜单
	//添加菜单功能
	menu.append(new MenuItem({
		label: "复制",
		click: function() {
			event.sender.send("context-menu-command", "copy");
		}
	}));
	//添加菜单分割线
	menu.append(new MenuItem({
		type: "separator"
	}));
	//添加菜单功能
	menu.append(new MenuItem({
		label: "粘贴",
		click: function() {
			event.sender.send("context-menu-command", "paste");
		}
	}));
	menu.popup(BrowserWindow.fromWebContents(event.sender));
});

ipcMain.on("open-path", (event, command) => {
	shell.openPath(command);
});

ipcMain.on("open-external", (event, command) => {
	shell.openExternal(command);
});

ipcMain.on("open-dialog", (event, command) => {
	dialog.showOpenDialog({
		defaultPath: command,
		properties: [
			"openDirectory", //打开路径
		],
		filters: [
			//{ name: "", extensions: ["json"] },
		]
	}).then(({ filePaths }) => {
		if (filePaths[0]) event.sender.send("download-path", filePaths[0]);
	});
});

ipcMain.on("show-error", (event, message) => {
	dialog.showMessageBox({
		type: "error",
		title: "[Error]",
		message
	});
});

ipcMain.on("show-warning", (event, message) => {
	dialog.showMessageBox({
		type: "warning",
		title: "[Warning]",
		message
	});
});

ipcMain.on("show-message", (event, message) => {
	dialog.showMessageBox({
		message
	});
});
