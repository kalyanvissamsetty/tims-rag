import { execFileSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, ".next");
const port = Number(process.env.PORT ?? "3000");

function getListeningPids(targetPort) {
  try {
    return execFileSync("lsof", ["-ti", `tcp:${targetPort}`], { encoding: "utf8" })
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getCommandForPid(pid) {
  try {
    return execFileSync("ps", ["-o", "command=", "-p", pid], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function canReachLocalServer(targetPort) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: "127.0.0.1",
        port: targetPort,
        path: "/",
        timeout: 1500
      },
      (response) => {
        response.resume();
        resolve(true);
      }
    );

    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });

    request.on("error", () => resolve(false));
  });
}

async function clearStalePortIfNeeded(targetPort) {
  const pids = getListeningPids(targetPort);

  if (!pids.length) {
    return;
  }

  const healthy = await canReachLocalServer(targetPort);
  if (healthy) {
    return;
  }

  for (const pid of pids) {
    const command = getCommandForPid(pid);
    if (command.includes("next") || command.includes("node")) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        // Best-effort cleanup for stale local dev processes.
      }
    }
  }
}

await clearStalePortIfNeeded(port);

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
}

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev"], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(port)
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
