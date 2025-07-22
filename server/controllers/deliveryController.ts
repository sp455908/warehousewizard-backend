import { Request, Response } from "express";
import { DeliveryRequestModel, type InsertDeliveryRequest } from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import crypto from "crypto";

export class DeliveryController {
  async createDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const deliveryData: InsertDeliveryRequest = {
        ...req.body,
        customerId: req.user!._id.toString(),
      };

      // Generate tracking number
      const trackingNumber = this.generateTrackingNumber();
      
      const delivery = new DeliveryRequestModel({
        ...deliveryData,
        trackingNumber,
      });
      
      await delivery.save();

      // Send confirmation notification
      await notificationService.sendEmail({
        to: req.user!.email,
        subject: "Delivery Request Created - Warehouse Wizard",
        html: `
          <h2>Delivery Request Created</h2>
          <p>Your delivery request has been created successfully.</p>
          <p>Tracking Number: <strong>${trackingNumber}</strong></p>
          <p>Delivery Address: ${deliveryData.deliveryAddress}</p>
          <p>Preferred Date: ${new Date(deliveryData.preferredDate).toLocaleDateString()}</p>
        `,
      });

      res.status(201).json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create delivery request", error });
    }
  }

  async getDeliveryRequests(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { status } = req.query;
      
      let filter: any = {};
      
      if (user.role === "customer") {
        filter.customerId = user._id;
      }
      
      if (status) {
        filter.status = status;
      } else {
        // Default filter based on role
        if (user.role === "supervisor") {
          filter.status = "requested";
        }
      }

      const deliveries = await DeliveryRequestModel.find(filter)
        .populate('customerId', 'firstName lastName email company')
        .populate('bookingId', 'warehouseId')
        .sort({ createdAt: -1 });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery requests", error });
    }
  }

  async getDeliveryRequestById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      const delivery = await DeliveryRequestModel.findById(id)
        .populate('customerId', 'firstName lastName email company mobile')
        .populate('bookingId', 'warehouseId customerId');

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Check permissions
      const user = req.user!;
      if (user.role === "customer" && delivery.customerId._id.toString() !== user._id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery request", error });
    }
  }

  async updateDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const delivery = await DeliveryRequestModel.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      ).populate('customerId', 'firstName lastName email')
       .populate('bookingId');

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      res.json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update delivery request", error });
    }
  }

  async scheduleDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { scheduledDate, assignedDriver } = req.body;

      const delivery = await DeliveryRequestModel.findByIdAndUpdate(
        id,
        { 
          status: "scheduled",
          assignedDriver,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('customerId', 'firstName lastName email');

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Send notification
      await notificationService.sendEmail({
        to: (delivery.customerId as any).email,
        subject: "Delivery Scheduled - Warehouse Wizard",
        html: `
          <h2>Delivery Scheduled</h2>
          <p>Your delivery has been scheduled.</p>
          <p>Tracking Number: ${delivery.trackingNumber}</p>
          <p>Assigned Driver: ${assignedDriver}</p>
          <p>You will receive updates as your delivery progresses.</p>
        `,
      });

      res.json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to schedule delivery", error });
    }
  }

  async assignDriver(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { assignedDriver } = req.body;

      const delivery = await DeliveryRequestModel.findByIdAndUpdate(
        id,
        { 
          assignedDriver,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      res.json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to assign driver", error });
    }
  }

  async dispatchDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const delivery = await DeliveryRequestModel.findByIdAndUpdate(
        id,
        { 
          status: "in_transit",
          updatedAt: new Date()
        },
        { new: true }
      ).populate('customerId', 'firstName lastName email');

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Send notification
      await notificationService.sendDeliveryNotification(
        (delivery.customerId as any).email,
        delivery.trackingNumber!
      );

      res.json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to dispatch delivery", error });
    }
  }

  async completeDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { deliveryNotes } = req.body;

      const delivery = await DeliveryRequestModel.findByIdAndUpdate(
        id,
        { 
          status: "delivered",
          updatedAt: new Date()
        },
        { new: true }
      ).populate('customerId', 'firstName lastName email');

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Send completion notification
      await notificationService.sendEmail({
        to: (delivery.customerId as any).email,
        subject: "Delivery Completed - Warehouse Wizard",
        html: `
          <h2>Delivery Completed</h2>
          <p>Your delivery has been completed successfully.</p>
          <p>Tracking Number: ${delivery.trackingNumber}</p>
          <p>Delivery Address: ${delivery.deliveryAddress}</p>
          ${deliveryNotes ? `<p>Notes: ${deliveryNotes}</p>` : ''}
          <p>Thank you for using Warehouse Wizard!</p>
        `,
      });

      res.json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to complete delivery", error });
    }
  }

  async trackDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      const delivery = await DeliveryRequestModel.findById(id)
        .populate('customerId', 'firstName lastName')
        .populate('bookingId', 'warehouseId');

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Return tracking information
      const trackingInfo = {
        trackingNumber: delivery.trackingNumber,
        status: delivery.status,
        deliveryAddress: delivery.deliveryAddress,
        preferredDate: delivery.preferredDate,
        assignedDriver: delivery.assignedDriver,
        urgency: delivery.urgency,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
      };

      res.json(trackingInfo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to track delivery", error });
    }
  }

  // Status-specific getters
  async getRequestedDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const deliveries = await DeliveryRequestModel.find({ status: "requested" })
        .populate('customerId', 'firstName lastName email company')
        .populate('bookingId', 'warehouseId')
        .sort({ createdAt: -1 });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch requested deliveries", error });
    }
  }

  async getScheduledDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const deliveries = await DeliveryRequestModel.find({ status: "scheduled" })
        .populate('customerId', 'firstName lastName email company')
        .sort({ preferredDate: 1 });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch scheduled deliveries", error });
    }
  }

  async getInTransitDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const deliveries = await DeliveryRequestModel.find({ status: "in_transit" })
        .populate('customerId', 'firstName lastName email company')
        .sort({ updatedAt: -1 });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch in-transit deliveries", error });
    }
  }

  async getDeliveredDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let filter: any = { status: "delivered" };

      if (user.role === "customer") {
        filter.customerId = user._id;
      }

      const deliveries = await DeliveryRequestModel.find(filter)
        .populate('customerId', 'firstName lastName email company')
        .sort({ updatedAt: -1 });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivered deliveries", error });
    }
  }

  private generateTrackingNumber(): string {
    const prefix = "WW";
    const timestamp = Date.now().toString().slice(-8);
    const random = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }
}

export const deliveryController = new DeliveryController();