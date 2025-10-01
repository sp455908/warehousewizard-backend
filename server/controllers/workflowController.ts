import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";

export class WorkflowController {
  // Get complete workflow history for a specific request
  async getWorkflowHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { requestId, requestType } = req.params;
      
      let history: any[] = [];
      
      if (requestType === "quote") {
        // Get quote workflow history
        const quote = await prisma.quote.findUnique({
          where: { id: requestId },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true } },
            warehouse: { select: { name: true, location: true } },
            assignedToUser: { select: { firstName: true, lastName: true, email: true } },
            bookings: {
              include: {
                cargoItems: true,
                cartingDetails: true,
                deliveries: true
              }
            }
          }
        });

        if (quote) {
          history = this.buildQuoteWorkflowHistory(quote);
        }
      } else if (requestType === "booking") {
        // Get booking workflow history
        const booking = await prisma.booking.findUnique({
          where: { id: requestId },
          include: {
            quote: {
              include: {
                customer: { select: { firstName: true, lastName: true, email: true } },
                warehouse: { select: { name: true, location: true } }
              }
            },
            cargoItems: true,
            cartingDetails: true,
            deliveries: true
          }
        });

        if (booking) {
          history = this.buildBookingWorkflowHistory(booking);
        }
      }

      res.json({ history });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch workflow history", error });
    }
  }

  // Get dashboard-specific workflow history
  async getDashboardWorkflowHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      const { role } = user;
      
      let workflowHistory: any[] = [];

      switch (role) {
        case "customer":
          workflowHistory = await this.getCustomerWorkflowHistory(user.id);
          break;
        case "purchase_support":
          workflowHistory = await this.getPurchaseWorkflowHistory();
          break;
        case "sales_support":
          workflowHistory = await this.getSalesWorkflowHistory();
          break;
        case "supervisor":
          workflowHistory = await this.getSupervisorWorkflowHistory();
          break;
        case "warehouse":
          workflowHistory = await this.getWarehouseWorkflowHistory(user.id);
          break;
        default:
          workflowHistory = [];
      }

      res.json({ workflowHistory });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch dashboard workflow history", error });
    }
  }

  private buildQuoteWorkflowHistory(quote: any): any[] {
    const history: any[] = [];
    
    // Step 1: Customer Search & Fill PR form
    history.push({
      step: 1,
      role: "Customer",
      action: "Search",
      subAction: "Filled PR form",
      status: "completed",
      timestamp: quote.createdAt,
      routedTo: "Purchase",
      details: `Quote created for ${quote.storageType} storage`
    });

    // Step 2: Purchase Get Warehouse Quote
    if (quote.status !== "pending") {
      history.push({
        step: 2,
        role: "Purchase",
        action: "Get Warehouse Quote",
        subAction: "Get Quote",
        status: "completed",
        timestamp: quote.updatedAt,
        routedTo: "Warehouse",
        details: "RFQ sent to warehouses"
      });
    }

    // Step 3: Warehouse Quote Update Price
    if (quote.status === "warehouse_quote_received" || quote.status === "processing") {
      history.push({
        step: 3,
        role: "Warehouse",
        action: "Warehouse Quote",
        subAction: "Update Price",
        status: "completed",
        timestamp: quote.updatedAt,
        routedTo: "Purchase",
        details: "Warehouse provided quote"
      });
    }

    // Step 4: Purchase Assign Warehouse
    if (quote.status === "processing" || quote.status === "quoted" || quote.status === "customer_confirmation_pending" || quote.status === "booking_confirmed") {
      history.push({
        step: 4,
        role: "Purchase",
        action: "Assign Warehouse",
        subAction: "Assign",
        status: "completed",
        timestamp: quote.updatedAt,
        routedTo: "Sales",
        details: `Assigned to ${quote.assignedToUser?.firstName} ${quote.assignedToUser?.lastName}`
      });
    }

    // Step 5: Sales Rate Confirmation
    if (quote.status === "quoted" || quote.status === "customer_confirmation_pending" || quote.status === "booking_confirmed") {
      history.push({
        step: 5,
        role: "Sales",
        action: "Rate Confirmation",
        subAction: "Review Price/Deny",
        status: "completed",
        timestamp: quote.updatedAt,
        routedTo: "Supervisor",
        details: "Rate confirmed by sales"
      });
    }

    // Step 6: Supervisor Confirmed bookings
    if (quote.status === "customer_confirmation_pending" || quote.status === "booking_confirmed") {
      history.push({
        step: 6,
        role: "Supervisor",
        action: "Confirmed bookings",
        subAction: "Customer Confirmation Pending",
        status: "completed",
        timestamp: quote.updatedAt,
        routedTo: "Customer",
        details: "Approved by supervisor"
      });
    }

    // Step 7: Customer Final Approval
    if (quote.status === "booking_confirmed") {
      history.push({
        step: 7,
        role: "Customer",
        action: "Final Approval",
        subAction: "Confirm Booking/Deny- Fill Booking Form",
        status: "completed",
        timestamp: quote.updatedAt,
        routedTo: "Supervisor",
        details: "Customer confirmed booking"
      });
    }

    // Add booking-related steps if booking exists
    if (quote.bookings && quote.bookings.length > 0) {
      const booking = quote.bookings[0];
      history.push(...this.buildBookingWorkflowHistory(booking));
    }

    return history;
  }

  private buildBookingWorkflowHistory(booking: any): any[] {
    const history: any[] = [];
    
    // Step 8: Supervisor Confirmed bookings
    if (booking.status === "confirmed" || booking.status === "active" || booking.status === "completed") {
      history.push({
        step: 8,
        role: "Supervisor",
        action: "Confirmed bookings",
        subAction: "Confirm",
        status: "completed",
        timestamp: booking.updatedAt,
        routedTo: "Customer/ Warehouse",
        details: "Booking confirmed by supervisor"
      });
    }

    // Step 9: Customer Confirmed bookings
    if (booking.status === "confirmed" || booking.status === "active" || booking.status === "completed") {
      history.push({
        step: 9,
        role: "Customer",
        action: "Confirmed bookings",
        subAction: "NA",
        status: "completed",
        timestamp: booking.updatedAt,
        routedTo: "NA",
        details: "Customer confirmed booking"
      });
    }

    // Step 10: Warehouse Confirmed bookings
    if (booking.status === "confirmed" || booking.status === "active" || booking.status === "completed") {
      history.push({
        step: 10,
        role: "Warehouse",
        action: "Confirmed bookings",
        subAction: "NA",
        status: "completed",
        timestamp: booking.updatedAt,
        routedTo: "NA",
        details: "Warehouse confirmed booking"
      });
    }

    // Add cargo dispatch steps
    if (booking.cargoItems && booking.cargoItems.length > 0) {
      const cargoDispatch = booking.cargoItems[0];
      history.push({
        step: 11,
        role: "Customer",
        action: "Cargo Dispatch Details (CDD)",
        subAction: "Save",
        status: "completed",
        timestamp: cargoDispatch.createdAt,
        routedTo: "Supervisor",
        details: "Cargo dispatch details submitted"
      });

      history.push({
        step: 12,
        role: "Supervisor",
        action: "CDD Confirmation",
        subAction: "Save",
        status: "completed",
        timestamp: cargoDispatch.updatedAt,
        routedTo: "Customer/ Warehouse",
        details: "CDD confirmed by supervisor"
      });
    }

    // Add carting details steps
    if (booking.cartingDetails && booking.cartingDetails.length > 0) {
      const cartingDetail = booking.cartingDetails[0];
      history.push({
        step: 15,
        role: "Warehouse",
        action: "Carting Details",
        subAction: "Save",
        status: "completed",
        timestamp: cartingDetail.createdAt,
        routedTo: "Customer/ Supervisor",
        details: "Carting details provided"
      });
    }

    // Add delivery request steps
    if (booking.deliveryRequests && booking.deliveryRequests.length > 0) {
      const deliveryRequest = booking.deliveryRequests[0];
      history.push({
        step: 18,
        role: "Customer",
        action: "Delivery Request",
        subAction: "Make Delivery Request",
        status: "completed",
        timestamp: deliveryRequest.createdAt,
        routedTo: "Supervisor",
        details: "Delivery request created"
      });
    }

    return history;
  }

  private async getCustomerWorkflowHistory(customerId: string): Promise<any[]> {
    const quotes = await prisma.quote.findMany({
      where: { customerId },
      include: {
        warehouse: { select: { name: true, location: true } },
        assignedToUser: { select: { firstName: true, lastName: true } },
        bookings: {
          include: {
            cargoItems: true,
            cartingDetails: true,
            deliveries: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const history: any[] = [];
    for (const quote of quotes) {
      history.push(...this.buildQuoteWorkflowHistory(quote));
    }

    return history;
  }

  private async getPurchaseWorkflowHistory(): Promise<any[]> {
    const quotes = await prisma.quote.findMany({
      where: {
        status: { in: [
          "pending", "warehouse_quote_requested", "warehouse_quote_received",
          "processing", "quoted", "customer_confirmation_pending", "booking_confirmed", "rejected"
        ] }
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        warehouse: { select: { name: true, location: true } },
        assignedToUser: { select: { firstName: true, lastName: true } },
        bookings: {
          include: {
            cargoItems: true,
            cartingDetails: true,
            deliveries: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const history: any[] = [];
    for (const quote of quotes) {
      history.push(...this.buildQuoteWorkflowHistory(quote));
    }

    return history;
  }

  private async getSalesWorkflowHistory(): Promise<any[]> {
    const quotes = await prisma.quote.findMany({
      where: {
        status: { in: ["processing", "quoted", "customer_confirmation_pending", "booking_confirmed", "rejected"] }
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        warehouse: { select: { name: true, location: true } },
        assignedToUser: { select: { firstName: true, lastName: true } },
        bookings: {
          include: {
            cargoItems: true,
            cartingDetails: true,
            deliveries: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const history: any[] = [];
    for (const quote of quotes) {
      history.push(...this.buildQuoteWorkflowHistory(quote));
    }

    return history;
  }

  private async getSupervisorWorkflowHistory(): Promise<any[]> {
    const quotes = await prisma.quote.findMany({
      where: {
        status: { in: ["quoted", "customer_confirmation_pending", "booking_confirmed", "rejected"] }
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        warehouse: { select: { name: true, location: true } },
        assignedToUser: { select: { firstName: true, lastName: true } },
        bookings: {
          include: {
            cargoItems: true,
            cartingDetails: true,
            deliveries: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const history: any[] = [];
    for (const quote of quotes) {
      history.push(...this.buildQuoteWorkflowHistory(quote));
    }

    return history;
  }

  private async getWarehouseWorkflowHistory(warehouseUserId: string): Promise<any[]> {
    const quotes = await prisma.quote.findMany({
      where: {
        status: { in: ["warehouse_quote_requested", "warehouse_quote_received", "processing", "quoted", "customer_confirmation_pending", "booking_confirmed"] }
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        warehouse: { select: { name: true, location: true } },
        assignedToUser: { select: { firstName: true, lastName: true } },
        bookings: {
          include: {
            cargoItems: true,
            cartingDetails: true,
            deliveries: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const history: any[] = [];
    for (const quote of quotes) {
      history.push(...this.buildQuoteWorkflowHistory(quote));
    }

    return history;
  }
}

export const workflowController = new WorkflowController();
