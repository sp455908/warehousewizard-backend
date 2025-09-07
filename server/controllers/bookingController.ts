import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { warehouseService } from "../services/warehouseService";
import { prisma } from "../config/prisma";

export class BookingController {
  async createBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const authUserId = req.user?.id;
      const bookingData = {
        ...req.body,
        customerId: authUserId,
      };

      // Check warehouse availability
      const isAvailable = await warehouseService.checkAvailability(
        bookingData.warehouseId,
        (req.body as any).requiredSpace || 0
      );

      if (!isAvailable) {
        return res.status(400).json({ message: "Insufficient warehouse space available" });
      }

      const booking = await prisma.booking.create({
        data: {
          quoteId: bookingData.quoteId,
          customerId: bookingData.customerId,
          warehouseId: bookingData.warehouseId,
          status: bookingData.status || 'pending',
          startDate: new Date(bookingData.startDate as any),
          endDate: new Date(bookingData.endDate as any),
          totalAmount: bookingData.totalAmount,
        }
      });

      // Send confirmation notification
      await notificationService.sendBookingConfirmationNotification(
        (req.user as any).email,
        booking.id
      );

      res.status(201).json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create booking", error });
    }
  }

  async getBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let where: any = {};
      if (user.role === "customer") {
        where.customerId = user.id || user._id?.toString();
      } else if (user.role === "supervisor") {
        where.status = "pending";
      }
      
      let bookings;
      if (user.role === "customer") {
        // Exclude pricing for customers
        bookings = await prisma.booking.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            quoteId: true,
            customerId: true,
            warehouseId: true,
            status: true,
            startDate: true,
            endDate: true,
            // Exclude totalAmount for customers
            approvedById: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
            quote: {
              select: {
                id: true,
                storageType: true,
                requiredSpace: true,
                preferredLocation: true,
                duration: true,
                specialRequirements: true,
                status: true,
                // Exclude finalPrice for customers
                createdAt: true,
                updatedAt: true
              }
            },
            approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } }
          }
        });
      } else {
        // Include all fields for other roles
        bookings = await prisma.booking.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
            quote: true,
            approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } }
          }
        });
      }

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch bookings", error });
    }
  }

  async getBookingRequests(req: AuthenticatedRequest, res: Response) {
    try {
      // Get all quotes that need warehouse quotes (for purchase support)
      const quotes = await prisma.quote.findMany({
        where: {
          status: "pending"
        },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
        }
      });

      // Transform quotes to booking request format
      const bookingRequests = quotes.map(quote => ({
        id: quote.id,
        bookingId: `2RB${quote.id.slice(-8).toUpperCase()}`,
        bookingDate: quote.createdAt.toISOString().replace('T', ' ').slice(0, 19),
        warehouseName: quote.warehouse?.name || "Not Assigned",
        remark: quote.specialRequirements ? "Special requirements" : "okl",
        status: quote.status,
        customerName: quote.customer ? `${quote.customer.firstName} ${quote.customer.lastName}` : "Unknown",
        customerEmail: quote.customer?.email || "Unknown",
        storageType: quote.storageType,
        requiredSpace: quote.requiredSpace,
        preferredLocation: quote.preferredLocation,
        duration: quote.duration,
        specialRequirements: quote.specialRequirements
      }));

      res.json(bookingRequests);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch booking requests", error });
    }
  }

  async processQuoteRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { remark } = req.body;

      // Update the quote with the remark and change status
      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: {
          specialRequirements: remark,
          status: "processing"
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
        }
      });

      // Send notification to warehouse
      await notificationService.sendQuoteRequestNotification(
        updatedQuote.customer?.email || "",
        updatedQuote.id,
        remark
      );

      res.json({ message: "Quote request processed successfully", quote: updatedQuote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to process quote request", error });
    }
  }

  async getBookingById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true, features: true, id: true } },
          quote: true,
          approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Check permissions
      const user = req.user! as any;
      if (user.role === "customer" && (booking as any).customerId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch booking", error });
    }
  }

  async updateBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const booking = await prisma.booking.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() as any },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update booking", error });
    }
  }

  async confirmBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const supervisorId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      const booking = await prisma.booking.update({
        where: { id },
        data: {
          status: "confirmed",
          approvedById: supervisorId,
          updatedAt: new Date() as any
        },
        include: { 
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          quote: true
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Update quote status to booking confirmed
      await prisma.quote.update({
        where: { id: (booking as any).quoteId },
        data: { status: "booking_confirmed" }
      });

      // Send confirmation notification
      await notificationService.sendEmail({
        to: (booking as any).customer.email,
        subject: "Booking Confirmed - Warehouse Wizard",
        html: `
          <h2>Booking Confirmed</h2>
          <p>Your booking has been confirmed by the supervisor.</p>
          <p>Booking ID: ${booking.id}</p>
          <p>Total Amount: $${booking.totalAmount}</p>
          <p>You can now proceed with cargo dispatch details.</p>
        `,
      });

      res.json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to confirm booking", error });
    }
  }

  async cancelBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const booking = await prisma.booking.update({
        where: { id },
        data: { status: "cancelled", updatedAt: new Date() as any },
        include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Send cancellation notification
      await notificationService.sendEmail({
        to: (booking as any).customer.email,
        subject: "Booking Cancelled - Warehouse Wizard",
        html: `
          <h2>Booking Cancelled</h2>
          <p>Your booking (ID: ${booking.id}) has been cancelled.</p>
          ${reason ? `<p>Reason: ${reason}</p>` : ''}
          <p>If you have any questions, please contact our support team.</p>
        `,
      });

      res.json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to cancel booking", error });
    }
  }

  async approveBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const customerId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      const booking = await prisma.booking.findFirst({ where: { id, customerId } });
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Remove or adjust this check, as 'quoted' is not a valid Booking status
      // If you want to check for a specific valid status, use one of the allowed values:
      // "pending", "confirmed", "active", "completed", "cancelled"
      if ((booking as any).status !== "pending") {
        return res.status(400).json({ message: "Booking cannot be approved in current status" });
      }

      const updatedBooking = await prisma.booking.update({ where: { id }, data: { status: "pending", updatedAt: new Date() as any } });

      res.json(updatedBooking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve booking", error });
    }
  }

  // Supervisor booking approval/rejection
  async approveBookingBySupervisor(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const supervisorId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      
      // Only supervisor can approve bookings
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const booking = await prisma.booking.update({
        where: { id },
        data: {
          status: "confirmed",
          approvedById: supervisorId,
          updatedAt: new Date() as any
        },
        include: { 
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          quote: true,
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Update quote status to booking confirmed
      await prisma.quote.update({
        where: { id: (booking as any).quoteId },
        data: { status: "booking_confirmed" }
      });

      // Send confirmation notification
      await notificationService.sendEmail({
        to: (booking as any).customer.email,
        subject: "Booking Approved - Warehouse Wizard",
        html: `
          <h2>Booking Approved</h2>
          <p>Your booking has been approved by the supervisor.</p>
          <p>Booking ID: ${booking.id}</p>
          <p>Warehouse: ${(booking.warehouse as any).name}</p>
          <p>You can now proceed with cargo dispatch details.</p>
        `,
      });

      res.json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve booking", error });
    }
  }

  async rejectBookingBySupervisor(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only supervisor can reject bookings
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const booking = await prisma.booking.update({
        where: { id },
        data: { 
          status: "cancelled", 
          updatedAt: new Date() as any 
        },
        include: { 
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Update quote status to rejected
      await prisma.quote.update({
        where: { id: (booking as any).quoteId },
        data: { 
          status: "rejected",
          specialRequirements: reason ? `Booking rejected: ${reason}` : "Booking rejected by supervisor"
        }
      });

      // Send rejection notification
      await notificationService.sendEmail({
        to: (booking as any).customer.email,
        subject: "Booking Rejected - Warehouse Wizard",
        html: `
          <h2>Booking Rejected</h2>
          <p>Your booking (ID: ${booking.id}) has been rejected by the supervisor.</p>
          ${reason ? `<p>Reason: ${reason}</p>` : ''}
          <p>If you have any questions, please contact our support team.</p>
        `,
      });

      res.json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject booking", error });
    }
  }

  async rejectBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const customerId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      const booking = await prisma.booking.update({ where: { id }, data: { status: "cancelled", updatedAt: new Date() as any } });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject booking", error });
    }
  }

  // Status-specific getters
  async getPendingBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const bookings = await prisma.booking.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
        }
      });

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch pending bookings", error });
    }
  }

  async getConfirmedBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let where: any = { status: "confirmed" };
      if (user.role === "customer") where.customerId = user.id || user._id?.toString();
      const bookings = await prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
          approvedBy: { select: { firstName: true, lastName: true, id: true } }
        }
      });

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch confirmed bookings", error });
    }
  }

  async getActiveBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let where: any = { status: "active" };
      if (user.role === "customer") where.customerId = user.id || user._id?.toString();
      const bookings = await prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
        }
      });

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch active bookings", error });
    }
  }

  async getCompletedBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let where: any = { status: "completed" };
      if (user.role === "customer") where.customerId = user.id || user._id?.toString();
      const bookings = await prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
        }
      });

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch completed bookings", error });
    }
  }

  // Supervisor booking approval/rejection
  async approveBookingBySupervisor(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const supervisorId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      
      // Only supervisor can approve bookings
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const booking = await prisma.booking.update({
        where: { id },
        data: {
          status: "confirmed",
          approvedById: supervisorId,
          updatedAt: new Date() as any
        },
        include: { 
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          quote: true,
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Update quote status to booking confirmed
      await prisma.quote.update({
        where: { id: (booking as any).quoteId },
        data: { status: "booking_confirmed" }
      });

      // Send confirmation notification
      await notificationService.sendEmail({
        to: (booking.customer as any).email,
        subject: "Booking Approved - Warehouse Wizard",
        html: `
          <h2>Booking Approved</h2>
          <p>Your booking has been approved by the supervisor.</p>
          <p>Booking ID: ${booking.id}</p>
          <p>Warehouse: ${(booking.warehouse as any).name}</p>
          <p>You can now proceed with cargo dispatch details.</p>
        `,
      });

      res.json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve booking", error });
    }
  }

  async rejectBookingBySupervisor(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only supervisor can reject bookings
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const booking = await prisma.booking.update({
        where: { id },
        data: { 
          status: "cancelled", 
          updatedAt: new Date() as any 
        },
        include: { 
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Update quote status to rejected
      await prisma.quote.update({
        where: { id: (booking as any).quoteId },
        data: { 
          status: "rejected",
          specialRequirements: reason ? `Booking rejected: ${reason}` : "Booking rejected by supervisor"
        }
      });

      // Send rejection notification
      await notificationService.sendEmail({
        to: (booking.customer as any).email,
        subject: "Booking Rejected - Warehouse Wizard",
        html: `
          <h2>Booking Rejected</h2>
          <p>Your booking (ID: ${booking.id}) has been rejected by the supervisor.</p>
          ${reason ? `<p>Reason: ${reason}</p>` : ''}
          <p>If you have any questions, please contact our support team.</p>
        `,
      });

      res.json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject booking", error });
    }
  }
}

export const bookingController = new BookingController();