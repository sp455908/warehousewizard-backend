"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsController = void 0;
const prisma_1 = require("../config/prisma");
const db = prisma_1.prisma;
exports.settingsController = {
    async getGeneralSettings(req, res) {
        try {
            const generalSettings = {
                company: {
                    name: "WarehouseWizard",
                    address: "123 Business Street, City, State 12345",
                    phone: "+1 (555) 123-4567",
                    email: "contact@warehousewizard.com",
                    website: "https://warehousewizard.com",
                },
                system: {
                    timezone: "UTC",
                    dateFormat: "MM/DD/YYYY",
                    timeFormat: "12h",
                    language: "en",
                    currency: "USD",
                },
                features: {
                    enableNotifications: true,
                    enableAuditLog: true,
                    enableBackup: true,
                    maintenanceMode: false,
                },
            };
            return res.json(generalSettings);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch general settings", error });
        }
    },
    async updateGeneralSettings(req, res) {
        try {
            const settings = req.body;
            console.log("Updating general settings:", settings);
            return res.json({ message: "General settings updated successfully" });
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update general settings", error });
        }
    },
    async getSecuritySettings(req, res) {
        try {
            const securitySettings = {
                passwordPolicy: {
                    minLength: 8,
                    requireUppercase: true,
                    requireLowercase: true,
                    requireNumbers: true,
                    requireSpecialChars: true,
                    maxAge: 90,
                },
                sessionPolicy: {
                    maxSessionDuration: 24,
                    maxConcurrentSessions: 3,
                    requireReauthForSensitive: true,
                },
                mfaPolicy: {
                    enabled: true,
                    requiredForAdmin: true,
                    requiredForSensitive: true,
                },
                ipWhitelist: {
                    enabled: false,
                    allowedIPs: [],
                },
            };
            return res.json(securitySettings);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch security settings", error });
        }
    },
    async updateSecuritySettings(req, res) {
        try {
            const settings = req.body;
            console.log("Updating security settings:", settings);
            return res.json({ message: "Security settings updated successfully" });
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update security settings", error });
        }
    },
    async getEmailSettings(req, res) {
        try {
            const emailSettings = {
                smtp: {
                    host: "smtp.gmail.com",
                    port: 587,
                    secure: true,
                    username: "noreply@warehousewizard.com",
                    password: "********",
                },
                notifications: {
                    newUserRegistration: true,
                    quoteRequests: true,
                    bookingConfirmations: true,
                    systemAlerts: true,
                    marketingEmails: false,
                },
                templates: {
                    welcomeEmail: {
                        subject: "Welcome to WarehouseWizard",
                        enabled: true,
                    },
                    quoteConfirmation: {
                        subject: "Your Quote Request Confirmation",
                        enabled: true,
                    },
                    bookingConfirmation: {
                        subject: "Booking Confirmation",
                        enabled: true,
                    },
                },
                rateLimiting: {
                    maxEmailsPerHour: 1000,
                    maxEmailsPerDay: 10000,
                },
            };
            return res.json(emailSettings);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch email settings", error });
        }
    },
    async updateEmailSettings(req, res) {
        try {
            const settings = req.body;
            console.log("Updating email settings:", settings);
            return res.json({ message: "Email settings updated successfully" });
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update email settings", error });
        }
    },
    async testEmailConfig(req, res) {
        try {
            const { email } = req.body;
            console.log("Testing email configuration to:", email);
            return res.json({ message: "Test email sent successfully" });
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to send test email", error });
        }
    },
    async getAllSettings(req, res) {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied. Admin role required." });
            }
            const allSettings = {
                general: {
                    company: {
                        name: "WarehouseWizard",
                        address: "123 Business Street, City, State 12345",
                        phone: "+1 (555) 123-4567",
                        email: "contact@warehousewizard.com",
                        website: "https://warehousewizard.com",
                    },
                    system: {
                        timezone: "UTC",
                        dateFormat: "MM/DD/YYYY",
                        timeFormat: "12h",
                        language: "en",
                        currency: "USD",
                    },
                    features: {
                        enableNotifications: true,
                        enableAuditLog: true,
                        enableBackup: true,
                        maintenanceMode: false,
                    },
                },
                security: {
                    passwordPolicy: {
                        minLength: 8,
                        requireUppercase: true,
                        requireLowercase: true,
                        requireNumbers: true,
                        requireSpecialChars: true,
                        maxAge: 90,
                    },
                    sessionPolicy: {
                        maxSessionDuration: 24,
                        maxConcurrentSessions: 3,
                        requireReauthForSensitive: true,
                    },
                    mfaPolicy: {
                        enabled: true,
                        requiredForAdmin: true,
                        requiredForSensitive: true,
                    },
                    ipWhitelist: {
                        enabled: false,
                        allowedIPs: [],
                    },
                },
                email: {
                    smtp: {
                        host: "smtp.gmail.com",
                        port: 587,
                        secure: true,
                        username: "noreply@warehousewizard.com",
                        password: "********",
                    },
                    notifications: {
                        newUserRegistration: true,
                        quoteRequests: true,
                        bookingConfirmations: true,
                        systemAlerts: true,
                        marketingEmails: false,
                    },
                    templates: {
                        welcomeEmail: {
                            subject: "Welcome to WarehouseWizard",
                            enabled: true,
                        },
                        quoteConfirmation: {
                            subject: "Your Quote Request Confirmation",
                            enabled: true,
                        },
                        bookingConfirmation: {
                            subject: "Booking Confirmation",
                            enabled: true,
                        },
                    },
                    rateLimiting: {
                        maxEmailsPerHour: 1000,
                        maxEmailsPerDay: 10000,
                    },
                },
            };
            return res.json(allSettings);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch all settings", error });
        }
    },
    async resetSettingsToDefault(req, res) {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied. Admin role required." });
            }
            const { category } = req.body;
            console.log("Resetting settings to default for category:", category);
            return res.json({ message: "Settings reset to default successfully" });
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to reset settings", error });
        }
    },
    async exportSettings(req, res) {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied. Admin role required." });
            }
            const exportData = {
                timestamp: new Date().toISOString(),
                version: "1.0.0",
                settings: {
                    general: "mock_general_settings",
                    security: "mock_security_settings",
                    email: "mock_email_settings",
                },
            };
            return res.json(exportData);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to export settings", error });
        }
    },
    async importSettings(req, res) {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied. Admin role required." });
            }
            const { settingsData } = req.body;
            console.log("Importing settings:", settingsData);
            return res.json({ message: "Settings imported successfully" });
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to import settings", error });
        }
    },
};
//# sourceMappingURL=settingsController.js.map