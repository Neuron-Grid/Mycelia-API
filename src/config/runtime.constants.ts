import { buildAppEnv } from "@/config/app-env";
import { ensureEnvLoaded } from "@/config/ensure-env";

ensureEnvLoaded();
const appEnv = buildAppEnv(process.env);

export const APP_ROLE = appEnv.appRole;
export const DEPLOY_STAGE = appEnv.deployStage;
export const IS_WORKER_APP = appEnv.isWorkerApp;
export const IS_API_APP = appEnv.isApiApp;
