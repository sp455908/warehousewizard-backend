import { Request, Response } from "express";
import { BookingModel, type InsertBooking } from "../../shared/schema";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { warehouseService } from "../services/warehouseService";

export class BookingController {
  async createBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const bookingData: InsertBooking = {
        ...req.body,
        customerId: req.user!._id.toString(),
      };

      // Check warehouse availability
      const isAvailable = await warehouseService.checkAvailability(
        bookingData.warehouseId,
        req.body.requiredSpace || 0
      );

      if (!isAvailable) {
        return res.status(400).json({ message: "Insufficient warehouse space available" });
      }

      const booking = new BookingModel(bookingData);
      await booking.save();

      // Send confirmation notification
      await notificationService.sendBookingConfirmationNotification(
        req.user!.email,
        booking._id.toString()
      );

      res.status(201).json(booking);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create booking", error });
    }
  }

  async getBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let bookings;

      if (user.role === "customer") {
        bookings = await BookingModel.find({ customerId: user._id })
          .populate('warehouseId', 'name location city state')
          .populate('quoteId')
          .sort({ createdAt: -1 });
      } else if (user.role === "supervisor") {
        bookings = await BookingModel.find({ status: "pending" })
          .populate('customerId', 'firstName lastName email company')
          .populate('warehouseId', 'name location city state')
          .sort({ createdAt: -1 });
      } else {
        // Admin and other roles can see all
        bookings = await BookingModel.find()
          .populate('customerId', 'firstName lastName email company')
          .populate('warehouseId', 'name location city state')
          .sort({ createdAt: -1 });
      }

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch bookings", error });
    }
  }

  async getBookingById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const booking = await BookingModel.findById(id)
        .populate('customerId', 'firstName lastName email company')
        .populate('warehouseId', 'name location city state features')
        .populate('quoteId')
        .populate('approvedBy', 'firstName lastName email');

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Check permissions
      const user = req.user!;
      if (user.role === "customer" && (booking.customerId as any)._id.toString() !== user._id.toString()) {
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

      const booking = await BookingModel.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      ).populate('customerId', 'firstName lastName email company')
       .populate('warehouseId', 'name location city state');

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
      const supervisorId = req.user!._id.toString();

      const booking = await BookingModel.findByIdAndUpdate(
        id,
        { 
          status: "confirmed",
          approvedBy: supervisorId,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('customerId', 'firstName lastName email company');

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Update warehouse available space
      // You'll need to get the required space from the quote or booking
      // await warehouseService.updateAvailableSpace(booking.warehouseId, -requiredSpace);

      // Send confirmation notification
      await notificationService.sendBookingConfirmationNotification(
        (booking.customerId as any).email,
        booking._id.toString()
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

      const booking = await BookingModel.findByIdAndUpdate(
        id,
        { 
          status: "cancelled",
          updatedAt: new Date()
        },
        { new: true }
      ).populate('customerId', 'firstName lastName email company');

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Send cancellation notification
      await notificationService.sendEmail({
        to: (booking.customerId as any).email,
        subject: "Booking Cancelled - Warehouse Wizard",
        html: `
          <h2>Booking Cancelled</h2>
          <p>Your booking (ID: ${booking._id}) has been cancelled.</p>
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
      const customerId = req.user!._id.toString();

      // Verify the booking belongs to the customer
      const booking = await BookingModel.findOne({ _id: id, customerId });
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Remove or adjust this check, as 'quoted' is not a valid Booking status
      // If you want to check for a specific valid status, use one of the allowed values:
      // "pending", "confirmed", "active", "completed", "cancelled"
      if (booking.status !== "pending") {
        return res.status(400).json({ message: "Booking cannot be approved in current status" });
      }

      const updatedBooking = await BookingModel.findByIdAndUpdate(
        id,
        { 
          status: "pending",
          updatedAt: new Date()
        },
        { new: true }
      );

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
      const customerId = req.user!._id.toString();

      const booking = await BookingModel.findOneAndUpdate(
        { _id: id, customerId },
        { 
          status: "cancelled",
          updatedAt: new Date()
        },
        { new: true }
      );

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
      const bookings = await BookingModel.find({ status: "pending" })
        .populate('customerId', 'firstName lastName email company')
        .populate('warehouseId', 'name location city state')
        .sort({ createdAt: -1 });

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch pending bookings", error });
    }
  }

  async getConfirmedBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let filter: any = { status: "confirmed" };

      if (user.role === "customer") {
        filter.customerId = user._id;
      }

      const bookings = await BookingModel.find(filter)
        .populate('customerId', 'firstName lastName email company')
        .populate('warehouseId', 'name location city state')
        .populate('approvedBy', 'firstName lastName')
        .sort({ createdAt: -1 });

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch confirmed bookings", error });
    }
  }

  async getActiveBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let filter: any = { status: "active" };

      if (user.role === "customer") {
        filter.customerId = user._id;
      }

      const bookings = await BookingModel.find(filter)
        .populate('customerId', 'firstName lastName email company')
        .populate('warehouseId', 'name location city state')
        .sort({ createdAt: -1 });

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch active bookings", error });
    }
  }

  async getCompletedBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let filter: any = { status: "completed" };

      if (user.role === "customer") {
        filter.customerId = user._id;
      }

      const bookings = await BookingModel.find(filter)
        .populate('customerId', 'firstName lastName email company')
        .populate('warehouseId', 'name location city state')
        .sort({ createdAt: -1 });

      res.json(bookings);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch completed bookings", error });
    }
  }
}

export const bookingController = new BookingController();