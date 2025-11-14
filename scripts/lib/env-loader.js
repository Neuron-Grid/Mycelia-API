const fs = require("node:fs");
const path = require("node:path");

const SRC_CONFIG_DIR = path.join(__dirname, "../../src/config");
const DIST_CONFIG_DIR = path.join(__dirname, "../../dist/config");

let tsRuntimeChecked = false;
let tsRuntimeAvailable = false;

function ensureTsRuntime() {
    if (tsRuntimeChecked) {
        return tsRuntimeAvailable;
    }

    tsRuntimeChecked = true;

    try {
        require("ts-node/register/transpile-only");
        tsRuntimeAvailable = true;
    } catch (error) {
        if (!isModuleNotFound(error)) {
            throw error;
        }
        tsRuntimeAvailable = false;
        return tsRuntimeAvailable;
    }

    try {
        require("tsconfig-paths/register");
    } catch (error) {
        if (!isModuleNotFound(error)) {
            throw error;
        }
    }

    return tsRuntimeAvailable;
}

function isModuleNotFound(error) {
    return Boolean(
        error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "MODULE_NOT_FOUND",
    );
}

function normalizeModuleName(moduleName) {
    return moduleName.replace(/\.(?:[cm]?js|tsx?|cts|mts)$/iu, "");
}

function loadConfigModule(moduleName) {
    const normalizedName = normalizeModuleName(moduleName);
    const srcModulePath = path.join(SRC_CONFIG_DIR, `${normalizedName}.ts`);
    const distModulePath = path.join(DIST_CONFIG_DIR, `${normalizedName}.js`);

    if (ensureTsRuntime() && fs.existsSync(srcModulePath)) {
        return require(srcModulePath);
    }

    if (fs.existsSync(distModulePath)) {
        return require(distModulePath);
    }

    if (ensureTsRuntime()) {
        throw new Error(
            `[env-loader] Config module "${normalizedName}" not found in src/config or dist/config.`,
        );
    }

    throw new Error(
        `[env-loader] Cannot load "${normalizedName}". dist/config build is missing (${distModulePath}) and ts-node is not installed. Install devDependencies or run "pnpm build" before executing CLI scripts.`,
    );
}

const { ensureEnvLoaded } = loadConfigModule("ensure-env");
const { buildAppEnv } = loadConfigModule("app-env");
const { validateEnv } = loadConfigModule("env.validation");

function buildCliAppEnv(env) {
    ensureEnvLoaded();
    validateEnv(env);
    return buildAppEnv(env);
}

module.exports = { buildCliAppEnv };
