"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get("/", (0, auth_1.authorizeRoles)("admin"), userController_1.userController.getRoles);
exports.default = router;
//# sourceMappingURL=rolesRoutes.js.map