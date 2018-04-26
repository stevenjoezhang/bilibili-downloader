function allow(index) {
	if (mainWindow) mainWindow.webContents.send("danmaku", JSON.stringify(output[index]));
}