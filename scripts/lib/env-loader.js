require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const { ensureEnvLoaded } = require("../../src/config/ensure-env");
const { buildAppEnv } = require("../../src/config/app-env");
const { validateEnv } = require("../../src/config/env.validation");

function buildCliAppEnv(env) {
    ensureEnvLoaded();
    validateEnv(env);
    return buildAppEnv(env);
}

module.exports = { buildCliAppEnv };
