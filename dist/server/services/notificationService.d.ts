export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    attachments?: any[];
}
export interface SMSOptions {
    to: string;
    message: string;
}
export declare class NotificationService {
    constructor();
    sendEmail(options: EmailOptions): Promise<boolean>;
    sendSMS(options: SMSOptions): Promise<boolean>;
    sendQuoteRequestNotification(customerEmail: string, quoteId: string): Promise<boolean>;
    sendQuoteApprovalNotification(customerEmail: string, quoteId: string, amount: number): Promise<boolean>;
    sendBookingConfirmationNotification(customerEmail: string, bookingId: string): Promise<boolean>;
    sendDeliveryNotification(customerEmail: string, trackingNumber: string): Promise<boolean>;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notificationService.d.ts.map