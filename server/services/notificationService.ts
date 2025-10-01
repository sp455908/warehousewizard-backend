import nodemailer from "nodemailer";
import { prisma } from "../config/prisma";
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

  // Role-based notification methods
  async sendNotificationToRole(role: string, subject: string, message: string, data?: any): Promise<boolean> {
    try {
      const users = await prisma.user.findMany({
        where: { 
          role: role as any,
          isActive: true,
          isEmailVerified: true
        }
      });

      const emailPromises = users.map(user => 
        this.sendEmail({
          to: user.email,
          subject: subject,
          html: `
            <h2>${subject}</h2>
            <p>${message}</p>
            ${data ? `
              <h3>Details:</h3>
              <ul>
                ${Object.entries(data).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
              </ul>
            ` : ''}
            <p>Please log in to your dashboard to take the required action.</p>
          `
        })
      );

      await Promise.all(emailPromises);
      return true;
    } catch (error) {
      console.error("Failed to send notification to role:", error);
      return false;
    }
  }

  async sendWorkflowNotification(quoteId: string, currentStep: string, nextStep: string, customerInfo?: any, warehouseInfo?: any): Promise<boolean> {
    try {
      // Get workflow step information
      const stepInfo = {
        C1: { role: "purchase_support", action: "Review Quote Request" },
        C2: { role: "purchase_support", action: "Accept/Reject Quote" },
        C3: { role: "purchase_support", action: "Get Same Warehouse Quote" },
        C4: { role: "purchase_support", action: "Get Multiple Warehouse Quote" },
        C5: { role: "warehouse", action: "Accept Same Warehouse Quote" },
        C6: { role: "warehouse", action: "Reject Same Warehouse Quote" },
        C7: { role: "warehouse", action: "Accept Multiple Warehouse Quote" },
        C8: { role: "warehouse", action: "Reject Multiple Warehouse Quote" },
        C9: { role: "purchase_support", action: "Assign Same Warehouse to Sales" },
        C10: { role: "purchase_support", action: "Assign Multiple Warehouse to Sales" },
        C11: { role: "sales_support", action: "Edit Rate and Add Margin (Same)" },
        C12: { role: "sales_support", action: "Select Best Warehouse and Edit Rate" },
        C13: { role: "customer", action: "Agree with Same Warehouse Rate" },
        C14: { role: "customer", action: "Reject Same Warehouse Rate" },
        C15: { role: "customer", action: "Agree with Multiple Warehouse Rate" },
        C16: { role: "customer", action: "Reject Multiple Warehouse Rate" },
        C17: { role: "supervisor", action: "Accept Same Warehouse Booking" },
        C18: { role: "supervisor", action: "Reject Same Warehouse Booking" },
        C19: { role: "supervisor", action: "Accept Multiple Warehouse Booking" },
        C20: { role: "supervisor", action: "Reject Multiple Warehouse Booking" },
        C21: { role: "customer", action: "Submit Cargo Dispatch Details" },
        C22: { role: "supervisor", action: "Confirm CDD" },
        C23: { role: "supervisor", action: "Reject CDD" },
        C24: { role: "warehouse", action: "Provide Carting Details" },
        C25: { role: "customer", action: "Submit Delivery Request" },
        C26: { role: "supervisor", action: "Accept Delivery Request" },
        C27: { role: "supervisor", action: "Reject Delivery Request" },
        C28: { role: "customer", action: "Send Invoice Request" },
        C29: { role: "warehouse", action: "Accept Invoice Request" },
        C30: { role: "warehouse", action: "Reject Invoice Request" },
        C31: { role: "customer", action: "Submit Payment Details" },
        C32: { role: "supervisor", action: "Issue Delivery Order" },
        C33: { role: "warehouse", action: "Generate Delivery Report" }
      };

      const nextStepInfo = stepInfo[nextStep as keyof typeof stepInfo];
      if (!nextStepInfo) return false;

      const subject = `Workflow Action Required - Quote ${quoteId}`;
      const message = `A workflow action is required for quote ${quoteId}. Current step: ${currentStep}, Next step: ${nextStep}`;
      
      const data = {
        "Quote ID": quoteId,
        "Current Step": currentStep,
        "Next Step": nextStep,
        "Action Required": nextStepInfo.action,
        ...(customerInfo && { "Customer": `${customerInfo.firstName} ${customerInfo.lastName}` }),
        ...(warehouseInfo && { "Warehouse": warehouseInfo.name })
      };

      return await this.sendNotificationToRole(nextStepInfo.role, subject, message, data);
    } catch (error) {
      console.error("Failed to send workflow notification:", error);
      return false;
    }
  }

  async sendNotificationToUser(userId: string, subject: string, message: string, data?: any): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.isActive) {
        return false;
      }

      return await this.sendEmail({
        to: user.email,
        subject: subject,
        html: `
          <h2>${subject}</h2>
          <p>${message}</p>
          ${data ? `
            <h3>Details:</h3>
            <ul>
              ${Object.entries(data).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
            </ul>
          ` : ''}
          <p>Please log in to your dashboard to take the required action.</p>
        `
      });
    } catch (error) {
      console.error("Failed to send notification to user:", error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
