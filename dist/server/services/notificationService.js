"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
class NotificationService {
    constructor() {
    }
    async sendEmail(options) {
        return true;
    }
    async sendSMS(options) {
        return true;
    }
    async sendQuoteRequestNotification(customerEmail, quoteId) {
        return true;
    }
    async sendQuoteApprovalNotification(customerEmail, quoteId, amount) {
        return true;
    }
    async sendBookingConfirmationNotification(customerEmail, bookingId) {
        return true;
    }
    async sendDeliveryNotification(customerEmail, trackingNumber) {
        return true;
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notificationService.js.map