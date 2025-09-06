"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warehouseController = exports.WarehouseController = void 0;
const warehouseService_1 = require("../services/warehouseService");
const zod_1 = require("zod");
const warehouseSearchSchema = zod_1.z.object({
    query: zod_1.z.string().optional(),
    storageType: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    minSpace: zod_1.z.string().transform(val => val ? parseInt(val) : undefined).optional(),
    maxPrice: zod_1.z.string().transform(val => val ? parseFloat(val) : undefined).optional(),
    features: zod_1.z.string().transform(val => val ? val.split(',') : []).optional(),
    sortBy: zod_1.z.enum(['price', 'space', 'name', 'location']).default('name'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc'),
    page: zod_1.z.preprocess(val => parseInt(val, 10), zod_1.z.number().default(1)),
    limit: zod_1.z.preprocess(val => parseInt(val, 10), zod_1.z.number().default(20)),
});
class WarehouseController {
    async getAllWarehouses(req, res) {
        try {
            const { city, state, storageType, minSpace, maxPrice } = req.query;
            const filters = {};
            if (city)
                filters.city = city;
            if (state)
                filters.state = state;
            if (storageType)
                filters.storageType = storageType;
            if (minSpace)
                filters.minSpace = parseInt(minSpace);
            if (maxPrice)
                filters.maxPrice = parseFloat(maxPrice);
            const warehouses = await warehouseService_1.warehouseService.getAllWarehouses(filters);
            res.json(warehouses);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch warehouses", error });
        }
    }
    async getWarehouseById(req, res) {
        try {
            const { id } = req.params;
            const warehouse = await warehouseService_1.warehouseService.getWarehouseById(id);
            if (!warehouse) {
                return res.status(404).json({ message: "Warehouse not found" });
            }
            res.json(warehouse);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch warehouse", error });
        }
    }
    async searchWarehouses(req, res) {
        try {
            const searchParams = warehouseSearchSchema.parse(req.query);
            const result = await warehouseService_1.warehouseService.searchWarehouses(searchParams);
            res.json(result);
            return;
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: "Invalid search parameters", errors: error.issues });
            }
            return res.status(500).json({ message: "Failed to search warehouses", error });
        }
    }
    async createWarehouse(req, res) {
        try {
            const warehouseData = req.body;
            const warehouse = await warehouseService_1.warehouseService.createWarehouse(warehouseData);
            res.status(201).json(warehouse);
            return;
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: "Invalid warehouse data", errors: error.issues });
            }
            return res.status(500).json({ message: "Failed to create warehouse", error });
        }
    }
    async updateWarehouse(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const warehouse = await warehouseService_1.warehouseService.updateWarehouse(id, updateData);
            if (!warehouse) {
                return res.status(404).json({ message: "Warehouse not found" });
            }
            res.json(warehouse);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update warehouse", error });
        }
    }
    async deleteWarehouse(req, res) {
        try {
            const { id } = req.params;
            const success = await warehouseService_1.warehouseService.deleteWarehouse(id);
            if (!success) {
                return res.status(404).json({ message: "Warehouse not found" });
            }
            res.json({ message: "Warehouse deleted successfully" });
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to delete warehouse", error });
        }
    }
    async getWarehousesByType(req, res) {
        try {
            const { type } = req.params;
            const warehouses = await warehouseService_1.warehouseService.getWarehousesByType(type);
            res.json(warehouses);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch warehouses by type", error });
        }
    }
    async getWarehousesByLocation(req, res) {
        try {
            const { city, state } = req.params;
            const warehouses = await warehouseService_1.warehouseService.getWarehousesByLocation(city, state);
            res.json(warehouses);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch warehouses by location", error });
        }
    }
    async checkAvailability(req, res) {
        try {
            const { id } = req.params;
            const { requiredSpace } = req.body;
            const isAvailable = await warehouseService_1.warehouseService.checkAvailability(id, requiredSpace);
            res.json({ available: isAvailable });
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to check availability", error });
        }
    }
    async getWarehouseTypes(req, res) {
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch warehouse types", error });
        }
    }
}
exports.WarehouseController = WarehouseController;
exports.warehouseController = new WarehouseController();
//# sourceMappingURL=warehouseController.js.map