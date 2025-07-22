import { Request, Response } from "express";
import { CargoDispatchDetailModel, type InsertCargoDispatchDetail } from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";

export class CargoController {
  async createCargoDispatch(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoData: InsertCargoDispatchDetail = req.body;
      
      const cargo = new CargoDispatchDetailModel(cargoData);
      await cargo.save();

      res.status(201).json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create cargo dispatch", error });
    }
  }

  async getCargoDispatches(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { bookingId, status } = req.query;
      
      let filter: any = {};
      
      if (bookingId) {
        filter.bookingId = bookingId;
      }
      
      if (status) {
        filter.status = status;
      } else {
        // Default filter based on role
        if (user.role === "supervisor") {
          filter.status = "submitted";
        }
      }

      const cargoItems = await CargoDispatchDetailModel.find(filter)
        .populate('bookingId', 'customerId warehouseId')
        .populate('approvedBy', 'firstName lastName email')
        .sort({ createdAt: -1 });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch cargo dispatches", error });
    }
  }

  async getCargoDispatchById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      const cargo = await CargoDispatchDetailModel.findById(id)
        .populate('bookingId', 'customerId warehouseId startDate endDate')
        .populate('approvedBy', 'firstName lastName email');

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch cargo dispatch", error });
    }
  }

  async updateCargoDispatch(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const cargo = await CargoDispatchDetailModel.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      ).populate('bookingId').populate('approvedBy', 'firstName lastName email');

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update cargo dispatch", error });
    }
  }

  async getCargoByBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      
      const cargoItems = await CargoDispatchDetailModel.find({ bookingId })
        .populate('approvedBy', 'firstName lastName email')
        .sort({ createdAt: -1 });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch cargo by booking", error });
    }
  }

  async approveCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const supervisorId = req.user!._id.toString();

      const cargo = await CargoDispatchDetailModel.findByIdAndUpdate(
        id,
        { 
          status: "approved",
          approvedBy: supervisorId,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('bookingId');

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      // Send notification
      await notificationService.sendEmail({
        to: "warehouse@example.com", // Get warehouse email from booking
        subject: "Cargo Dispatch Approved",
        html: `
          <h2>Cargo Dispatch Approved</h2>
          <p>Cargo dispatch (ID: ${cargo._id}) has been approved.</p>
          <p>Item: ${cargo.itemDescription}</p>
          <p>Quantity: ${cargo.quantity}</p>
        `,
      });

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve cargo", error });
    }
  }

  async rejectCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const cargo = await CargoDispatchDetailModel.findByIdAndUpdate(
        id,
        { 
          status: "submitted", // Reset to submitted for revision
          specialHandling: reason ? `Rejected: ${reason}` : "Rejected",
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject cargo", error });
    }
  }

  async processCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const cargo = await CargoDispatchDetailModel.findByIdAndUpdate(
        id,
        { 
          status: "processing",
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to process cargo", error });
    }
  }

  async completeCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const cargo = await CargoDispatchDetailModel.findByIdAndUpdate(
        id,
        { 
          status: "completed",
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to complete cargo", error });
    }
  }

  // Status-specific getters
  async getSubmittedCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await CargoDispatchDetailModel.find({ status: "submitted" })
        .populate('bookingId', 'customerId warehouseId')
        .sort({ createdAt: -1 });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch submitted cargo", error });
    }
  }

  async getApprovedCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await CargoDispatchDetailModel.find({ status: "approved" })
        .populate('bookingId', 'customerId warehouseId')
        .populate('approvedBy', 'firstName lastName')
        .sort({ createdAt: -1 });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch approved cargo", error });
    }
  }

  async getProcessingCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await CargoDispatchDetailModel.find({ status: "processing" })
        .populate('bookingId', 'customerId warehouseId')
        .sort({ createdAt: -1 });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch processing cargo", error });
    }
  }

  async getCompletedCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await CargoDispatchDetailModel.find({ status: "completed" })
        .populate('bookingId', 'customerId warehouseId')
        .sort({ createdAt: -1 });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch completed cargo", error });
    }
  }
}

export const cargoController = new CargoController();