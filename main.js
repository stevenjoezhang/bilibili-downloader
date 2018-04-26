const electron = require("electron")
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require("path")
const url = require("url")

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let panelWindow

function createPanel() {

  panelWindow = new BrowserWindow({
    width: 400,
    height: electron.screen.getPrimaryDisplay().workAreaSize.height,
    resizable: false,
    fullscreenable: false,
    title: "Mimi Danmaku Panel"
  })

  panelWindow.loadURL(url.format({
    pathname: path.join(__dirname, "panel.html"),
    protocol: "file:",
    slashes: true
  }))

  panelWindow.setPosition(0, 0, true);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  panelWindow.on("closed", function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    panelWindow = null
  })
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createPanel)

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", function () {
  // On OS X it"s common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (panelWindow === null) {
    createPanel()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
