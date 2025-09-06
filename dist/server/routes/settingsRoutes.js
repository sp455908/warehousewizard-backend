"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settingsController_1 = require("../controllers/settingsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.use((0, auth_1.authorizeRoles)("admin"));
router.get("/general", settingsController_1.settingsController.getGeneralSettings);
router.put("/general", settingsController_1.settingsController.updateGeneralSettings);
router.get("/security", settingsController_1.settingsController.getSecuritySettings);
router.put("/security", settingsController_1.settingsController.updateSecuritySettings);
router.get("/email", settingsController_1.settingsController.getEmailSettings);
router.put("/email", settingsController_1.settingsController.updateEmailSettings);
router.post("/email/test", settingsController_1.settingsController.testEmailConfig);
exports.default = router;
//# sourceMappingURL=settingsRoutes.js.map