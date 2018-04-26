// Create the browser window.
function createWindow() {

	var fullScreen = true, onTop = "main-menu", backgroundImage = false;

	if (options[0] == 1) fullScreen = false;
	if (options[1] == 1) onTop = "floating";
	if (options[2] == 1 && !fullScreen) backgroundImage = true;

	try {
		if (fullScreen) {
			mainWindow = new BrowserWindow({
				width: electron.screen.getPrimaryDisplay().workAreaSize.width,
				height: electron.screen.getPrimaryDisplay().workAreaSize.height,
				transparent: true,
				frame: false,
				toolbar: false,
				resizable: true,
				//alwaysOnTop: true,
				title: "Mimi Danmaku"
			});

			mainWindow.setIgnoreMouseEvents(true);
			//app.dock.hide();
			mainWindow.setAlwaysOnTop(true, onTop); //normal, floating, torn-off-menu, modal-panel, /* keynote and dock */, main-menu, status, pop-up-menu, screen-saver
			//mainWindow.setVisibleOnAllWorkspaces(true);
			//mainWindow.setFullScreenable(false);
			//mainWindow.setMenu(null);
		}

		else mainWindow = new BrowserWindow({
			width: 800,
			height: 600,
			transparent: !backgroundImage,
			frame: true,
			title: "Mimi Danmaku"
		});

		// and load the index.html of the app.
		mainWindow.loadURL(url.format({
			pathname: path.join(__dirname, "index.html"),
			protocol: "file:",
			slashes: true
		}));

		mainWindow.webContents.on("did-finish-load", function() {
			mainWindow.webContents.send("background", backgroundImage);
			mainWindow.webContents.send("setchannel", getChannel());
		});

		mainWindow.on("closed", function() {
			$("#submit").html("开启弹幕窗口");
			$("#submit").removeClass("btn-danger");
			$("#submit").addClass("btn-primary");
			mainWindow = null;
		});
	}
	catch (e) {
		alert(e);
	}
}

function closeWindow() {
	mainWindow.close();
	mainWindow = null;
}
