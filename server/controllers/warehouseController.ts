import { Request, Response } from "express";
import { warehouseService } from "../services/warehouseService";
import { prisma } from "../config/prisma";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth";

const warehouseSearchSchema = z.object({
  query: z.string().optional(),
  storageType: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  minSpace: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
  maxPrice: z.string().transform(val => val ? parseFloat(val) : undefined).optional(),
  features: z.string().transform(val => val ? val.split(',') : []).optional(),
  sortBy: z.enum(['price', 'space', 'name', 'location']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.preprocess(val => parseInt(val as string, 10), z.number().default(1)),
  limit: z.preprocess(val => parseInt(val as string, 10), z.number().default(20)),
});

export class WarehouseController {
  async getAllWarehouses(req: AuthenticatedRequest, res: Response) {
    try {
      const { city, state, storageType, minSpace } = req.query;
      const user = req.user; // Make user optional for public access
      
      const filters: any = {};
      if (city) filters.city = city as string;
      if (state) filters.state = state as string;
      if (storageType) filters.storageType = storageType as string;
      if (minSpace) filters.minSpace = parseInt(minSpace as string);
      
      // Filter warehouses based on user role and ownership
      if (user && user.role === 'warehouse') {
        // Warehouse users can only see their own warehouses
        filters.ownerId = user.id;
      } else if (user && user.role !== 'admin') {
        // Non-admin users see only active warehouses
        filters.isActive = true;
      } else if (!user) {
        // Public access (no authentication) - show only active warehouses
        filters.isActive = true;
      }
      // Admins can see all warehouses

      const warehouses = await warehouseService.getAllWarehouses(filters, true); // excludePricing = true
      res.json(warehouses);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch warehouses", error });
    }
  }

  async getWarehouseById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      const warehouse = await prisma.warehouse.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          location: true,
          city: true,
          state: true,
          storageType: true,
          totalSpace: true,
          availableSpace: true,
          pricePerSqFt: user.role === 'admin' || user.role === 'warehouse', // Show pricing to admin and warehouse owners
          features: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          imageUrl: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true
            }
          }
        }
      });
      
      if (!warehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      
      // Check ownership for warehouse users
      if (user.role === 'warehouse' && warehouse.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied to this warehouse" });
      }
      
      res.json(warehouse);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch warehouse", error });
    }
  }

  async searchWarehouses(req: Request, res: Response) {
    try {
      const searchParams = warehouseSearchSchema.parse(req.query);
      const result = await warehouseService.searchWarehouses(searchParams);
      res.json(result);
      return;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid search parameters", errors: error.issues });
      }
      return res.status(500).json({ message: "Failed to search warehouses", error });
    }
  }

  async createWarehouse(req: AuthenticatedRequest, res: Response) {
    try {
      const warehouseData = req.body;
      const user = req.user!;
      
      // Only warehouse users can create warehouses (admins cannot create warehouses)
      if (user.role !== 'warehouse') {
        return res.status(403).json({ message: "Only warehouse owners can create warehouses" });
      }
      
      // Set owner to the current warehouse user
      warehouseData.ownerId = user.id;
      
      const warehouse = await warehouseService.createWarehouse(warehouseData);
      res.status(201).json(warehouse);
      return;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid warehouse data", errors: error.issues });
      }
      return res.status(500).json({ message: "Failed to create warehouse", error });
    }
  }

  async updateWarehouse(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const user = req.user!;
      
      // Check if warehouse exists and get ownership info
      const existingWarehouse = await prisma.warehouse.findUnique({
        where: { id },
        select: { 
          ownerId: true,
          name: true,
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });
      
      if (!existingWarehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      
      // Strict ownership validation for warehouse users
      if (user.role === 'warehouse') {
        if (existingWarehouse.ownerId !== user.id) {
          console.log(`Security Alert: Warehouse user ${user.email} (${user.id}) attempted to update warehouse ${id} owned by ${existingWarehouse.owner?.email} (${existingWarehouse.ownerId})`);
          return res.status(403).json({ 
            message: "Access denied: You can only update warehouses that you own",
            code: "OWNERSHIP_VIOLATION"
          });
        }
      } else if (user.role !== 'admin') {
        return res.status(403).json({ 
          message: "Insufficient permissions to update warehouse",
          code: "INSUFFICIENT_PERMISSIONS"
        });
      }
      
      // Log the update for audit purposes
      console.log(`Warehouse update: User ${user.email} (${user.id}) updating warehouse "${existingWarehouse.name}" (${id})`);
      
      const warehouse = await warehouseService.updateWarehouse(id, updateData);
      
      if (!warehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      
      res.json(warehouse);
      return;
    } catch (error) {
      console.error("Error updating warehouse:", error);
      return res.status(500).json({ message: "Failed to update warehouse", error });
    }
  }

  async deleteWarehouse(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      // Check if warehouse exists and get ownership info
      const existingWarehouse = await prisma.warehouse.findUnique({
        where: { id },
        select: { 
          ownerId: true,
          name: true,
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });
      
      if (!existingWarehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      
      // Only admins can delete any warehouse, or warehouse users can delete their own warehouses
      if (user.role !== 'admin' && existingWarehouse.ownerId !== user.id) {
        console.log(`Security Alert: User ${user.email} (${user.id}) attempted to delete warehouse ${id} owned by ${existingWarehouse.owner?.email} (${existingWarehouse.ownerId})`);
        return res.status(403).json({ 
          message: "You can only delete warehouses that you own",
          code: "INSUFFICIENT_PERMISSIONS"
        });
      }
      
      // Log the deletion for audit purposes
      const deleterRole = user.role === 'admin' ? 'Admin' : 'Warehouse Owner';
      console.log(`Warehouse deletion: ${deleterRole} ${user.email} (${user.id}) deleting warehouse "${existingWarehouse.name}" (${id}) owned by ${existingWarehouse.owner?.email} (${existingWarehouse.ownerId})`);
      
      const result = await warehouseService.deleteWarehouse(id);
      
      if (!result.success) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      
      if (result.deleted) {
        if (result.reason === "Related records preserved") {
          res.json({ 
            message: "Warehouse deleted successfully. Related records (bookings, quotes, etc.) have been preserved with warehouse reference removed.",
            deleted: true,
            recordsPreserved: true
          });
        } else {
          res.json({ 
            message: "Warehouse deleted successfully",
            deleted: true
          });
        }
      } else {
        res.json({ 
          message: "Failed to delete warehouse",
          deleted: false
        });
      }
      return;
    } catch (error) {
      console.error("Error deleting warehouse:", error);
      return res.status(500).json({ message: "Failed to delete warehouse", error });
    }
  }

  async getWarehousesByType(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const warehouses = await warehouseService.getWarehousesByType(type as any);
      res.json(warehouses);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch warehouses by type", error });
    }
  }

  async getWarehousesByLocation(req: Request, res: Response) {
    try {
      const { city, state } = req.params;
      const warehouses = await warehouseService.getWarehousesByLocation(city, state);
      res.json(warehouses);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch warehouses by location", error });
    }
  }

  async checkAvailability(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { requiredSpace } = req.body;
      
      const isAvailable = await warehouseService.checkAvailability(id, requiredSpace);
      res.json({ available: isAvailable });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to check availability", error });
    }
  }

  // Get warehouse categories/types
  async getWarehouseTypes(req: Request, res: Response) {
    try {
      const types = [
        { value: 'domestic_dry', label: 'Domestic Dry', description: 'Standard dry storage for general goods' },
        { value: 'domestic_reefer', label: 'Domestic Reefer', description: 'Temperature-controlled storage for perishables' },
        { value: 'bonded_dry', label: 'Bonded Dry', description: 'Bonded warehouse for duty-free storage' },
        { value: 'bonded_reefer', label: 'Bonded Reefer', description: 'Bonded cold storage facility' },
        { value: 'cfs_import', label: 'CFS Import', description: 'Container freight station for imports' },
        { value: 'cfs_export_dry', label: 'CFS Export Dry', description: 'Container freight station for dry exports' },
        { value: 'cfs_export_reefer', label: 'CFS Export Reefer', description: 'Container freight station for reefer exports' }
      ];
      
      res.json(types);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch warehouse types", error });
    }
  }

  // Get warehouses owned by a specific user
  async getMyWarehouses(req: AuthenticatedRequest, res: Response) {
    try {
      console.log("[getMyWarehouses] Function called");
      
      const user = req.user!;
      console.log(`[getMyWarehouses] User: ${user.email} (${user.id}) with role: ${user.role}`);
      
      if (user.role !== 'warehouse' && user.role !== 'admin') {
        console.log(`[getMyWarehouses] Access denied for user ${user.email} with role ${user.role}`);
        return res.status(403).json({ 
          message: "Insufficient permissions",
          code: "INSUFFICIENT_PERMISSIONS"
        });
      }
      
      // For warehouse users, only show their own warehouses
      // For admins, show all warehouses (they can manage any warehouse)
      const whereClause = user.role === 'warehouse' 
        ? { ownerId: user.id } 
        : {};
      
      console.log(`[getMyWarehouses] Query where clause:`, whereClause);
      
      console.log("[getMyWarehouses] About to query warehouses...");
      const warehouses = await prisma.warehouse.findMany({
        where: whereClause,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      console.log(`[getMyWarehouses] Found ${warehouses.length} warehouses`);

      // Add basic counts without complex queries for now
      const warehousesWithCounts = warehouses.map(warehouse => ({
        ...warehouse,
        _count: {
          bookings: 0,
          quotes: 0,
          rfqs: 0
        }
      }));
      
      // Log the query for audit purposes
      console.log(`[getMyWarehouses] Success: User ${user.email} (${user.id}) with role ${user.role} fetched ${warehousesWithCounts.length} warehouses`);
      
      res.json(warehousesWithCounts);
      return;
    } catch (error) {
      console.error("[getMyWarehouses] Detailed error:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      return res.status(500).json({ 
        message: "Failed to fetch warehouses", 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Transfer warehouse ownership (admin only)
  async transferOwnership(req: AuthenticatedRequest, res: Response) {
    try {
      const { warehouseId, newOwnerId } = req.body;
      const user = req.user!;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only administrators can transfer warehouse ownership" });
      }
      
      // Verify new owner exists and is a warehouse user
      const newOwner = await prisma.user.findUnique({
        where: { id: newOwnerId },
        select: { id: true, role: true, isActive: true }
      });
      
      if (!newOwner || newOwner.role !== 'warehouse' || !newOwner.isActive) {
        return res.status(400).json({ message: "Invalid warehouse user" });
      }
      
      // Update warehouse ownership
      const warehouse = await prisma.warehouse.update({
        where: { id: warehouseId },
        data: { ownerId: newOwnerId },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true
            }
          }
        }
      });
      
      res.json({ message: "Warehouse ownership transferred successfully", warehouse });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to transfer ownership", error });
    }
  }

  // Get warehouse owners (admin only)
  async getWarehouseOwners(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const owners = await prisma.user.findMany({
        where: { 
          role: 'warehouse',
          isActive: true
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true,
          createdAt: true,
          _count: {
            select: {
              ownedWarehouses: true
            }
          }
        },
        orderBy: { firstName: 'asc' }
      });
      
      res.json(owners);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch warehouse owners", error });
    }
  }
}

export const warehouseController = new WarehouseController();