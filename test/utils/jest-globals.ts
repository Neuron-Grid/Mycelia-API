import { createRequire } from "node:module";

type JestGlobal = typeof globalThis.jest;

const requireFromJest = createRequire(require.resolve("jest/package.json"));

const { jest: jestGlobals } = requireFromJest("@jest/globals") as {
    jest: JestGlobal;
};

export const jest = jestGlobals;
