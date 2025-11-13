import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { prisma } from "../config/prisma";

export class CargoController {
  async createCargoDispatch(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoData = req.body;
      console.log("[DEBUG] Creating cargo dispatch with data:", JSON.stringify(cargoData, null, 2));
      console.log("[DEBUG] FormData received:", cargoData.formData);
      
      // Prepare formData for Prisma - ensure it's a valid JSON object
      let formDataJson = null;
      if (cargoData.formData) {
        // If it's already an object, use it directly
        // If it's a string, parse it
        if (typeof cargoData.formData === 'string') {
          try {
            formDataJson = JSON.parse(cargoData.formData);
          } catch (e) {
            console.error("[DEBUG] Error parsing formData string:", e);
            formDataJson = cargoData.formData;
          }
        } else {
          // It's already an object, use it directly
          formDataJson = cargoData.formData;
        }
      }
      
      console.log("[DEBUG] FormData to save:", JSON.stringify(formDataJson, null, 2));
      
      const cargo = await prisma.cargoDispatchDetail.create({ data: {
        bookingId: cargoData.bookingId,
        itemDescription: cargoData.itemDescription,
        quantity: cargoData.quantity,
        weight: cargoData.weight ?? null,
        dimensions: cargoData.dimensions ?? null,
        specialHandling: cargoData.specialHandling ?? null,
        formData: formDataJson,
        status: cargoData.status || 'submitted',
      } });

      console.log("[DEBUG] Cargo dispatch created successfully:", cargo);
      console.log("[DEBUG] Saved formData:", cargo.formData);
      res.status(201).json(cargo);
      return;
    } catch (error) {
      console.log("[DEBUG] Error creating cargo dispatch:", error);
      return res.status(500).json({ message: "Failed to create cargo dispatch", error });
    }
  }

  async getCargoDispatches(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      const { bookingId, status } = req.query;
      
      console.log("[DEBUG] Getting cargo dispatches for user role:", user.role);
      
      let filter: any = {};
      
      if (bookingId) {
        filter.bookingId = bookingId as string;
      }
      
      if (status && status !== "all") {
        filter.status = status as string;
      } else if (status === "all") {
        // Don't filter by status - get all cargo dispatches
        // filter.status is not set, so all statuses will be returned
      } else {
        // Default filter based on role
        if (user.role === "supervisor") {
          filter.status = "submitted";
        }
      }

      console.log("[DEBUG] Filter for cargo dispatches:", filter);

      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' },
        include: {
          approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } },
          booking: { 
            select: { 
              id: true, 
              customerId: true, 
              warehouseId: true,
              customer: { 
                select: { 
                  firstName: true, 
                  lastName: true, 
                  email: true, 
                  company: true 
                } 
              },
              warehouse: { 
                select: { 
                  name: true, 
                  location: true, 
                  city: true 
                } 
              }
            } 
          }
        }
      });

      console.log("[DEBUG] Found cargo dispatches:", cargoItems.length);
      res.json(cargoItems);
      return;
    } catch (error) {
      console.log("[DEBUG] Error fetching cargo dispatches:", error);
      return res.status(500).json({ message: "Failed to fetch cargo dispatches", error });
    }
  }

  async getCargoDispatchById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const cargo = await prisma.cargoDispatchDetail.findUnique({
        where: { id },
        include: {
          approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } },
          booking: { select: { id: true, customerId: true, warehouseId: true, startDate: true, endDate: true } }
        }
      });

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
      const cargo = await prisma.cargoDispatchDetail.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() as any },
        include: {
          booking: true,
          approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } }
        }
      });

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
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
        include: { approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } } }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch cargo by booking", error });
    }
  }

  async approveCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const supervisorId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      const cargo = await prisma.cargoDispatchDetail.update({
        where: { id },
        data: { status: "approved", approvedById: supervisorId, updatedAt: new Date() as any },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: {
                select: {
                  name: true,
                  location: true,
                  owner: { select: { firstName: true, lastName: true, email: true } }
                }
              }
            }
          }
        }
      });

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      const booking = cargo.booking as any;
      const customerEmail = booking?.customer?.email;
      const warehouseEmail =
        booking?.warehouse?.owner?.email || "warehouse@example.com";

      // Notify warehouse
      await notificationService.sendEmail({
        to: warehouseEmail,
        subject: "Cargo Dispatch Approved",
        html: `
          <h2>Cargo Dispatch Approved</h2>
          <p>Cargo dispatch (ID: ${cargo.id}) has been approved.</p>
          <p>Item: ${cargo.itemDescription}</p>
          <p>Quantity: ${cargo.quantity}</p>
        `,
      });

      // Notify customer
      if (customerEmail) {
        await notificationService.sendEmail({
          to: customerEmail,
          subject: "CDD Approved",
          html: `
            <h2>Cargo Dispatch Details Approved</h2>
            <p>Your cargo dispatch details have been approved by the supervisor.</p>
            <p><strong>Booking ID:</strong> ${cargo.bookingId}</p>
            <p><strong>Item:</strong> ${cargo.itemDescription}</p>
            <p><strong>Quantity:</strong> ${cargo.quantity}</p>
          `,
        });
      }

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
      const cargo = await prisma.cargoDispatchDetail.update({
        where: { id },
        data: {
          status: "submitted",
          specialHandling: reason ? `Rejected: ${reason}` : "Rejected",
          updatedAt: new Date() as any
        }
      });

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
      const cargo = await prisma.cargoDispatchDetail.update({ where: { id }, data: { status: "processing", updatedAt: new Date() as any } });

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
      const cargo = await prisma.cargoDispatchDetail.update({ where: { id }, data: { status: "completed", updatedAt: new Date() as any } });

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
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { status: "submitted" },
        orderBy: { createdAt: 'desc' },
        include: { booking: { select: { id: true, customerId: true, warehouseId: true } } }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch submitted cargo", error });
    }
  }

  async getApprovedCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { status: "approved" },
        orderBy: { createdAt: 'desc' },
        include: {
          booking: { select: { id: true, customerId: true, warehouseId: true } },
          approvedBy: { select: { firstName: true, lastName: true, id: true } }
        }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch approved cargo", error });
    }
  }

  async getProcessingCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { status: "processing" },
        orderBy: { createdAt: 'desc' },
        include: { booking: { select: { id: true, customerId: true, warehouseId: true } } }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch processing cargo", error });
    }
  }

  async getCompletedCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { status: "completed" },
        orderBy: { createdAt: 'desc' },
        include: { booking: { select: { id: true, customerId: true, warehouseId: true } } }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch completed cargo", error });
    }
  }
}

export const cargoController = new CargoController();