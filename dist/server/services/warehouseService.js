"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warehouseService = exports.WarehouseService = void 0;
const cacheService_1 = require("./cacheService");
const prisma_1 = require("../config/prisma");
class WarehouseService {
    async getAllWarehouses(filters) {
        const cached = await cacheService_1.cacheService.getWarehouses(filters);
        if (cached) {
            return cached;
        }
        const where = { isActive: true };
        if (filters) {
            if (filters.city)
                where.city = { contains: filters.city, mode: 'insensitive' };
            if (filters.state)
                where.state = { contains: filters.state, mode: 'insensitive' };
            if (filters.storageType)
                where.storageType = filters.storageType;
            if (filters.minSpace)
                where.availableSpace = { gte: filters.minSpace };
            if (filters.maxPrice)
                where.pricePerSqFt = { lte: filters.maxPrice };
        }
        const warehouses = await prisma_1.prisma.warehouse.findMany({ where, orderBy: { name: 'asc' } });
        await cacheService_1.cacheService.setWarehouses(warehouses, filters);
        return warehouses;
    }
    async getWarehouseById(id) {
        return await prisma_1.prisma.warehouse.findUnique({ where: { id } });
    }
    async getWarehousesByType(storageType) {
        return this.getAllWarehouses({ storageType });
    }
    async getWarehousesByLocation(city, state) {
        return this.getAllWarehouses({ city, state });
    }
    async createWarehouse(warehouseData) {
        const savedWarehouse = await prisma_1.prisma.warehouse.create({ data: {
                name: warehouseData.name,
                location: warehouseData.location,
                city: warehouseData.city,
                state: warehouseData.state,
                storageType: warehouseData.storageType,
                totalSpace: warehouseData.totalSpace,
                availableSpace: warehouseData.availableSpace,
                pricePerSqFt: warehouseData.pricePerSqFt,
                features: warehouseData.features,
                isActive: warehouseData.isActive ?? true,
            } });
        await cacheService_1.cacheService.invalidateWarehouses();
        return savedWarehouse;
    }
    async updateWarehouse(id, updateData) {
        const warehouse = await prisma_1.prisma.warehouse.update({ where: { id }, data: updateData });
        if (warehouse) {
            await cacheService_1.cacheService.invalidateWarehouses();
        }
        return warehouse;
    }
    async deleteWarehouse(id) {
        const result = await prisma_1.prisma.warehouse.update({ where: { id }, data: { isActive: false } });
        if (result) {
            await cacheService_1.cacheService.invalidateWarehouses();
            return true;
        }
        return false;
    }
    async checkAvailability(warehouseId, requiredSpace) {
        const warehouse = await prisma_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
        return warehouse ? warehouse.availableSpace >= requiredSpace : false;
    }
    async updateAvailableSpace(warehouseId, spaceChange) {
        await prisma_1.prisma.warehouse.update({ where: { id: warehouseId }, data: { availableSpace: { increment: spaceChange } } });
        await cacheService_1.cacheService.invalidateWarehouses();
    }
    async searchWarehouses(searchParams) {
        const { query, storageType, city, state, minSpace, maxPrice, features, sortBy = 'name', sortOrder = 'asc', page = 1, limit = 20 } = searchParams;
        const filter = { isActive: true };
        if (query) {
            filter.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { location: { contains: query, mode: 'insensitive' } },
                { city: { contains: query, mode: 'insensitive' } }
            ];
        }
        if (storageType)
            filter.storageType = storageType;
        if (city)
            filter.city = { contains: city, mode: 'insensitive' };
        if (state)
            filter.state = { contains: state, mode: 'insensitive' };
        if (minSpace)
            filter.availableSpace = { gte: minSpace };
        if (maxPrice)
            filter.pricePerSqFt = { lte: maxPrice };
        if (features && features.length > 0) {
            filter.AND = features.map(feature => ({
                features: { path: [feature], equals: true }
            }));
        }
        const orderBy = {};
        switch (sortBy) {
            case 'price':
                orderBy.pricePerSqFt = sortOrder;
                break;
            case 'space':
                orderBy.availableSpace = sortOrder;
                break;
            case 'location':
                orderBy.city = sortOrder;
                break;
            default:
                orderBy.name = sortOrder;
        }
        const skip = (page - 1) * limit;
        const [warehouses, total] = await Promise.all([
            prisma_1.prisma.warehouse.findMany({
                where: filter,
                orderBy,
                skip,
                take: limit
            }),
            prisma_1.prisma.warehouse.count({ where: filter })
        ]);
        return {
            warehouses,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
}
exports.WarehouseService = WarehouseService;
exports.warehouseService = new WarehouseService();
//# sourceMappingURL=warehouseService.js.map