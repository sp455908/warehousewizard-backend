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
      const bookings = await prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
          quote: true,
          approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } }
        }
      });

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch bookings", error });
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
        include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Update warehouse available space
      // You'll need to get the required space from the quote or booking
      // await warehouseService.updateAvailableSpace(booking.warehouseId, -requiredSpace);

      // Send confirmation notification
      await notificationService.sendBookingConfirmationNotification(
        (booking as any).customer.email,
        booking.id
      );

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
}

export const bookingController = new BookingController();