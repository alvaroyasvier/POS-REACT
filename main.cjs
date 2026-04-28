const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

let backendProcess;
let mainWindow;

function getServerPath() {
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : __dirname;
  return path.join(basePath, "server.js");
}

function waitForBackend() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 30;
    const check = () => {
      attempts++;
      const req = http.get(
        "http://localhost:3000/api/health",
        { timeout: 2000 },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 200) {
              try {
                const json = JSON.parse(data);
                if (json.success) return resolve();
              } catch (e) {}
            }
            attempts >= maxAttempts
              ? reject(new Error("Timeout"))
              : setTimeout(check, 1000);
          });
        },
      );
      req.on("error", () => {
        attempts >= maxAttempts
          ? reject(new Error("Timeout"))
          : setTimeout(check, 1000);
      });
      req.end();
    };
    check();
  });
}

function startBackend() {
  const serverPath = getServerPath();
  if (!fs.existsSync(serverPath)) {
    console.error(`❌ No se encontró server.js en: ${serverPath}`);
    app.quit();
    return;
  }
  console.log(`🚀 Iniciando backend desde: ${serverPath}`);

  backendProcess = spawn("node", [serverPath], {
    stdio: "pipe",
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: app.isPackaged ? "production" : "development",
    },
    cwd: path.dirname(serverPath),
  });

  backendProcess.stdout.on("data", (d) =>
    console.log(`[Backend] ${d.toString().trim()}`),
  );
  backendProcess.stderr.on("data", (d) =>
    console.error(`[Backend ERROR] ${d.toString().trim()}`),
  );
  backendProcess.on("error", (err) => {
    console.error("❌ Error backend:", err);
    app.quit();
  });
  backendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null)
      console.error(`❌ Backend terminó: ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    title: "Sistema POS",
    show: false,
  });

  const url = !app.isPackaged
    ? "http://localhost:5173/login"
    : "http://localhost:3000/login";
  console.log(`🖥️ Cargando URL: ${url}`);

  mainWindow.loadURL(url).catch((err) => console.error("❌ Error URL:", err));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (!app.isPackaged) mainWindow.webContents.openDevTools();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  console.log("⚡ Electron listo");
  startBackend();
  try {
    await waitForBackend();
    createWindow();
  } catch (err) {
    console.error("❌ Fallo conexión backend:", err);
    if (!app.isPackaged) createWindow();
    else app.quit();
  }
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill("SIGTERM");
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (backendProcess) backendProcess.kill();
});
