import { Request, Response } from "express";
import { warehouseService } from "../services/warehouseService";
import { z } from "zod";

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
  async getAllWarehouses(req: Request, res: Response) {
    try {
      const { city, state, storageType, minSpace, maxPrice } = req.query;
      
      const filters: any = {};
      if (city) filters.city = city as string;
      if (state) filters.state = state as string;
      if (storageType) filters.storageType = storageType as string;
      if (minSpace) filters.minSpace = parseInt(minSpace as string);
      if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);

      const warehouses = await warehouseService.getAllWarehouses(filters);
      res.json(warehouses);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch warehouses", error });
    }
  }

  async getWarehouseById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const warehouse = await warehouseService.getWarehouseById(id);
      
      if (!warehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
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

  async createWarehouse(req: Request, res: Response) {
    try {
      const warehouseData = req.body;
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

  async updateWarehouse(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const warehouse = await warehouseService.updateWarehouse(id, updateData);
      
      if (!warehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      
      res.json(warehouse);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update warehouse", error });
    }
  }

  async deleteWarehouse(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await warehouseService.deleteWarehouse(id);
      
      if (!success) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      
      res.json({ message: "Warehouse deleted successfully" });
      return;
    } catch (error) {
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
        { value: 'dry_storage', label: 'Domestic Dry', description: 'Standard dry storage for general goods' },
        { value: 'cold_storage', label: 'Domestic Reefer', description: 'Temperature-controlled storage for perishables' },
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
}

export const warehouseController = new WarehouseController();