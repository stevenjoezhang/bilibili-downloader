const electron = require("electron");
// Module to control application life.
// Module to create native browser window.
const { app, dialog, BrowserWindow } = electron;
const ipc = electron.ipcMain;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
var length;

function createPanel() {

	mainWindow = new BrowserWindow({
		width         : 600,
		minWidth      : 600,
		height        : electron.screen.getPrimaryDisplay().workAreaSize.height,
		minHeight     : 600,
		fullscreenable: false,
		title         : "Mimi Downloader",
		webPreferences: {
			nodeIntegration: true
		}
	});

	mainWindow.loadURL(`file://${__dirname}/panel.html`);

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
		}
		if (length && dialog.showMessageBox(options)) e.preventDefault();
	});

	// Emitted when the window is closed.
	mainWindow.on("closed", (e) => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createPanel);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== "darwin") {
		//app.quit();
	}
});

app.on("activate", () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createPanel();
	}
	else mainWindow.restore();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipc.on("length", (event, message) => {
	length = message;
});

process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = true;
