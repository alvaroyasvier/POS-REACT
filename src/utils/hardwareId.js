// src/utils/hardwareId.js
import os from "os";
import crypto from "crypto";
import { execSync } from "child_process";

const getDiskSerial = () => {
  try {
    if (process.platform === "win32") {
      const output = execSync(
        'wmic diskdrive where "Index=0" get serialnumber',
        { encoding: "utf8", windowsHide: true },
      );
      const lines = output.split("\n").filter((l) => l.trim());
      return lines[1]?.trim() || "UNKNOWN_DISK";
    }
    return "UNKNOWN_DISK";
  } catch {
    return "UNKNOWN_DISK";
  }
};

const getMotherboardUUID = () => {
  try {
    if (process.platform === "win32") {
      const output = execSync("wmic csproduct get uuid", {
        encoding: "utf8",
        windowsHide: true,
      });
      const lines = output.split("\n").filter((l) => l.trim());
      return lines[1]?.trim() || "UNKNOWN_MB";
    }
    return "UNKNOWN_MB";
  } catch {
    return "UNKNOWN_MB";
  }
};

const getMacAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    if (
      name.toLowerCase().includes("virtual") ||
      name.toLowerCase().includes("loopback")
    )
      continue;
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
        return iface.mac.replace(/[:-]/g, "").toUpperCase();
      }
    }
  }
  return "UNKNOWN_MAC";
};

export const getMachineId = () => {
  const factors = [
    getMacAddress(),
    getDiskSerial(),
    getMotherboardUUID(),
    os.hostname(),
    os.cpus()[0]?.model.replace(/\s+/g, "") || "UNKNOWN_CPU",
    os.totalmem().toString(),
  ];
  const combined = factors.join("|");
  return crypto
    .createHash("sha512")
    .update(combined)
    .digest("hex")
    .substring(0, 48);
};

export const getMachineHash = () => {
  return crypto.createHash("md5").update(getMachineId()).digest("hex");
};
