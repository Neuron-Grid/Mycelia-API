const lifecycle = process.env.npm_lifecycle_event ?? "";
const argGuess = process.argv[1] ?? "";

const derivedRole =
    process.env.APP_ROLE ??
    (lifecycle.includes("worker")
        ? "worker"
        : lifecycle.includes("api")
          ? "api"
          : undefined) ??
    (argGuess.includes("worker") ? "worker" : undefined) ??
    "api";

export const APP_ROLE = (derivedRole as "api" | "worker").toLowerCase();
export const IS_WORKER_APP = APP_ROLE === "worker";
export const IS_API_APP = APP_ROLE === "api";
