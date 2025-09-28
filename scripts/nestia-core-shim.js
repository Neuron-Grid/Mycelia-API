const common = require("@nestjs/common");

const wrapMethod = (fn) => (path) => fn(path);
exports.TypedRoute = {
    Get: wrapMethod(common.Get),
    Post: wrapMethod(common.Post),
    Put: wrapMethod(common.Put),
    Patch: wrapMethod(common.Patch),
    Delete: wrapMethod(common.Delete),
    Head: wrapMethod(common.Head || common.Get),
    Options: wrapMethod(common.Options || common.Get),
    HttpCode: (code) => common.HttpCode(code),
};

exports.TypedParam = (name) => (name ? common.Param(name) : common.Param());
exports.TypedBody = () => common.Body();
exports.TypedQuery = (name) => (name ? common.Query(name) : common.Query());
