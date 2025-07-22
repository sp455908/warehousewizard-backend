import nodemailer from "nodemailer";
// import twilio from "twilio"; // Commented out for now

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

export class NotificationService {
  // private emailTransporter: any;
  // private twilioClient: any;

  constructor() {
    // this.setupEmailTransporter();
    // this.setupTwilioClient();
  }

  // private setupEmailTransporter() {
  //   this.emailTransporter = nodemailer.createTransport({
  //     host: process.env.SMTP_HOST || "smtp.gmail.com",
  //     port: parseInt(process.env.SMTP_PORT || "587"),
  //     secure: false,
  //     auth: {
  //       user: process.env.SMTP_USER,
  //       pass: process.env.SMTP_PASS,
  //     },
  //   });
  // }

  // private setupTwilioClient() {
  //   if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  //     this.twilioClient = twilio(
  //       process.env.TWILIO_ACCOUNT_SID,
  //       process.env.TWILIO_AUTH_TOKEN
  //     );
  //   }
  // }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    // Email sending disabled for now
    // try {
    //   await this.emailTransporter.sendMail({
    //     from: process.env.FROM_EMAIL || "noreply@warehousewizard.com",
    //     ...options,
    //   });
    //   return true;
    // } catch (error) {
    //   console.error("Email sending failed:", error);
    //   return false;
    // }
    return true;
  }

  async sendSMS(options: SMSOptions): Promise<boolean> {
    // SMS sending disabled for now
    // if (!this.twilioClient) {
    //   console.warn("Twilio not configured, skipping SMS");
    //   return false;
    // }
    // try {
    //   await this.twilioClient.messages.create({
    //     body: options.message,
    //     from: process.env.TWILIO_PHONE_NUMBER,
    //     to: options.to,
    //   });
    //   return true;
    // } catch (error) {
    //   console.error("SMS sending failed:", error);
    //   return false;
    // }
    return true;
  }

  // Notification templates
  async sendQuoteRequestNotification(customerEmail: string, quoteId: string) {
    // Disabled for now
    // const emailOptions: EmailOptions = {
    //   to: customerEmail,
    //   subject: "Quote Request Received - Warehouse Wizard",
    //   html: `
    //     <h2>Quote Request Received</h2>
    //     <p>Your quote request (ID: ${quoteId}) has been received and is being processed.</p>
    //     <p>You will receive an update within 24 hours.</p>
    //     <p>Thank you for choosing Warehouse Wizard!</p>
    //   `,
    // };
    // return this.sendEmail(emailOptions);
    return true;
  }

  async sendQuoteApprovalNotification(customerEmail: string, quoteId: string, amount: number) {
    // Disabled for now
    // const emailOptions: EmailOptions = {
    //   to: customerEmail,
    //   subject: "Quote Approved - Warehouse Wizard",
    //   html: `
    //     <h2>Quote Approved</h2>
    //     <p>Your quote request (ID: ${quoteId}) has been approved.</p>
    //     <p>Total Amount: $${amount}</p>
    //     <p>Please log in to your dashboard to proceed with booking.</p>
    //   `,
    // };
    // return this.sendEmail(emailOptions);
    return true;
  }

  async sendBookingConfirmationNotification(customerEmail: string, bookingId: string) {
    // Disabled for now
    // const emailOptions: EmailOptions = {
    //   to: customerEmail,
    //   subject: "Booking Confirmed - Warehouse Wizard",
    //   html: `
    //     <h2>Booking Confirmed</h2>
    //     <p>Your booking (ID: ${bookingId}) has been confirmed.</p>
    //     <p>You can track your booking status in your dashboard.</p>
    //   `,
    // };
    // return this.sendEmail(emailOptions);
    return true;
  }

  async sendDeliveryNotification(customerEmail: string, trackingNumber: string) {
    // Disabled for now
    // const emailOptions: EmailOptions = {
    //   to: customerEmail,
    //   subject: "Delivery Update - Warehouse Wizard",
    //   html: `
    //     <h2>Delivery Update</h2>
    //     <p>Your delivery is in transit.</p>
    //     <p>Tracking Number: ${trackingNumber}</p>
    //     <p>You can track your delivery in your dashboard.</p>
    //   `,
    // };
    // return this.sendEmail(emailOptions);
    return true;
  }
}

export const notificationService = new NotificationService();
