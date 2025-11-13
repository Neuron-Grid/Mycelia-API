import { buildAppEnv } from "@/config/app-env";

const appEnv = buildAppEnv(process.env);

export const APP_ROLE = appEnv.appRole;
export const IS_WORKER_APP = appEnv.isWorkerApp;
export const IS_API_APP = appEnv.isApiApp;
