"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = void 0;
exports.validateRequest = validateRequest;
const zod_1 = require("zod");
function validateRequest(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            return next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: "Invalid request data", errors: error.issues });
            }
            return res.status(500).json({ message: "Validation failed", error });
        }
    };
}
const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.query);
            return next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({
                    message: "Query validation failed",
                    errors: error.issues,
                });
            }
            return next(error);
        }
    };
};
exports.validateQuery = validateQuery;
//# sourceMappingURL=validation.js.map