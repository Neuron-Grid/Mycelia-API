#!/usr/bin/env node
const { spawn } = require("node:child_process");

const processes = [];

function spawnProcess(label, args, role) {
    const child = spawn("node", args, {
        stdio: "inherit",
        env: {
            ...process.env,
            APP_ROLE: role,
        },
    });

    child.on("exit", (code, signal) => {
        const reason = signal !== null ? `${signal}` : `code ${code ?? 0}`;
        console.log(`[start:prod] ${label} exited with ${reason}`);
        terminateOthers(child);
        process.exit(code ?? 0);
    });

    processes.push(child);
}

function terminateOthers(exitedChild) {
    for (const child of processes) {
        if (child === exitedChild) continue;
        if (child.killed) continue;
        child.kill("SIGTERM");
    }
}

function forwardSignal(signal) {
    process.once(signal, () => {
        console.log(`[start:prod] received ${signal}, shutting down...`);
        for (const child of processes) {
            if (!child.killed) {
                child.kill(signal);
            }
        }
    });
}

spawnProcess("api", ["dist/main.api.js"], "api");
spawnProcess("worker", ["dist/main.worker.js"], "worker");

forwardSignal("SIGINT");
forwardSignal("SIGTERM");
