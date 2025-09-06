"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const adminSecurity_1 = require("../middleware/adminSecurity");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const insertUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    mobile: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
    role: zod_1.z.enum(["customer", "purchase_support", "sales_support", "supervisor", "warehouse", "accounts", "admin"]).default("customer"),
    isActive: zod_1.z.boolean().default(true),
    isEmailVerified: zod_1.z.boolean().default(false),
    isMobileVerified: zod_1.z.boolean().default(false),
});
router.use(auth_1.authenticateToken);
router.use(adminSecurity_1.logAdminAttempts);
router.use(adminSecurity_1.preventAdminRoleCreation);
router.get("/profile", userController_1.userController.getProfile);
router.put("/profile", userController_1.userController.updateProfile);
router.post("/change-password", userController_1.userController.changePassword);
router.get("/", (0, auth_1.authorizeRoles)("admin"), userController_1.userController.getAllUsers);
router.get("/:id", (0, auth_1.authorizeRoles)("admin"), userController_1.userController.getUserById);
router.post("/", (0, auth_1.authorizeRoles)("admin"), (0, validation_1.validateRequest)(insertUserSchema), userController_1.userController.createUser);
router.put("/:id", (0, auth_1.authorizeRoles)("admin"), userController_1.userController.updateUser);
router.delete("/:id", (0, auth_1.authorizeRoles)("admin"), userController_1.userController.deleteUser);
router.get("/role/:role", (0, auth_1.authorizeRoles)("admin"), userController_1.userController.getUsersByRole);
router.post("/:id/activate", (0, auth_1.authorizeRoles)("admin"), userController_1.userController.activateUser);
router.post("/:id/deactivate", (0, auth_1.authorizeRoles)("admin"), userController_1.userController.deactivateUser);
router.post("/:id/verify", (0, auth_1.authorizeRoles)("purchase_support", "admin"), userController_1.userController.verifyGuestCustomer);
router.get("/guests/pending", (0, auth_1.authorizeRoles)("purchase_support", "admin"), userController_1.userController.getPendingGuestCustomers);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map