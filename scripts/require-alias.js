const Module = require("node:module");
const path = require("node:path");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === "@nestia/core") {
        const shim = path.resolve(__dirname, "nestia-core-shim.js");
        return originalLoad.call(this, shim, parent, isMain);
    }
    return originalLoad.call(this, request, parent, isMain);
};
