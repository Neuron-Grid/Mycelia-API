const { buildAppEnv } = require("../../dist/config/app-env");
const { validateEnv } = require("../../dist/config/env.validation");

function buildCliAppEnv(env) {
    validateEnv(env);
    return buildAppEnv(env);
}

module.exports = { buildCliAppEnv };
