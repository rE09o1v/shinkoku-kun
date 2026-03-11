import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);

const bindingByPlatform = {
  "linux:x64": "@tauri-apps/cli-linux-x64-gnu",
  "win32:x64": "@tauri-apps/cli-win32-x64-msvc",
};

const platformKey = `${process.platform}:${process.arch}`;
const expectedBinding = bindingByPlatform[platformKey];
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

if (expectedBinding) {
  try {
    require.resolve(expectedBinding);
  } catch {
    const runtimeName = process.platform === "win32" ? "Windows" : process.platform;
    console.error(
      [
        `Missing Tauri native binding for ${runtimeName} (${process.arch}).`,
        `Expected package: ${expectedBinding}`,
        "",
        "This usually means node_modules was installed from a different OS.",
        `Run npm install from ${runtimeName} in this project before running Tauri again.`,
        "If that still fails, delete node_modules and reinstall on the same OS you use to run Tauri.",
      ].join("\n"),
    );
    process.exit(1);
  }
}

const tauriEntrypoint = require.resolve("@tauri-apps/cli/tauri.js");
const child = spawn(process.execPath, [tauriEntrypoint, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: path.resolve(scriptDir, ".."),
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
