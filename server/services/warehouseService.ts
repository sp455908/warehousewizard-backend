import { cacheService } from "./cacheService";
import { prisma } from "../config/prisma";
import { StorageType } from "@prisma/client";
import { WarehouseModel } from "../../shared/schema";

export interface WarehouseFilters {
  city?: string;
  state?: string;
  storageType?: StorageType;
  minSpace?: number;
  maxPrice?: number;
}

export class WarehouseService {
  async getAllWarehouses(filters?: WarehouseFilters) {
    // Try to get from cache first
    const cached = await cacheService.getWarehouses(filters);
    if (cached) {
      return cached;
    }

    let warehouses;

    if (prisma) {
      // Use Prisma if available
      const where: any = { isActive: true };
      if (filters) {
        if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
        if (filters.state) where.state = { contains: filters.state, mode: 'insensitive' };
        if (filters.storageType) where.storageType = filters.storageType;
        if (filters.minSpace) where.availableSpace = { gte: filters.minSpace };
        if (filters.maxPrice) where.pricePerSqFt = { lte: filters.maxPrice };
      }

      warehouses = await prisma.warehouse.findMany({ where, orderBy: { name: 'asc' } });
    } else {
      // Fallback to MongoDB
      const mongoFilters: any = { isActive: true };
      if (filters) {
        if (filters.city) mongoFilters.city = { $regex: filters.city, $options: 'i' };
        if (filters.state) mongoFilters.state = { $regex: filters.state, $options: 'i' };
        if (filters.storageType) mongoFilters.storageType = filters.storageType;
        if (filters.minSpace) mongoFilters.availableSpace = { $gte: filters.minSpace };
        if (filters.maxPrice) mongoFilters.pricePerSqFt = { $lte: filters.maxPrice };
      }

      warehouses = await WarehouseModel.find(mongoFilters).sort({ name: 1 });
    }
    
    // Cache the results
    await cacheService.setWarehouses(warehouses, filters);
    
    return warehouses;
  }

  async getWarehouseById(id: string) {
    if (prisma) {
      return await prisma.warehouse.findUnique({ where: { id } });
    } else {
      return await WarehouseModel.findById(id);
    }
  }

  async getWarehousesByType(storageType: StorageType) {
    return this.getAllWarehouses({ storageType });
  }

  async getWarehousesByLocation(city: string, state: string) {
    return this.getAllWarehouses({ city, state });
  }

  async createWarehouse(warehouseData: any) {
    const savedWarehouse = await prisma.warehouse.create({ data: {
      name: warehouseData.name,
      location: warehouseData.location,
      city: warehouseData.city,
      state: warehouseData.state,
      storageType: warehouseData.storageType,
      totalSpace: warehouseData.totalSpace,
      availableSpace: warehouseData.availableSpace,
      pricePerSqFt: warehouseData.pricePerSqFt,
      features: warehouseData.features as any,
      isActive: warehouseData.isActive ?? true,
    } });
    
    // Invalidate cache
    await cacheService.invalidateWarehouses();
    
    return savedWarehouse;
  }

  async updateWarehouse(id: string, updateData: any) {
    const warehouse = await prisma.warehouse.update({ where: { id }, data: updateData as any });
    
    if (warehouse) {
      // Invalidate cache
      await cacheService.invalidateWarehouses();
    }
    
    return warehouse;
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    const result = await prisma.warehouse.update({ where: { id }, data: { isActive: false } });
    
    if (result) {
      // Invalidate cache
      await cacheService.invalidateWarehouses();
      return true;
    }
    
    return false;
  }

  async checkAvailability(warehouseId: string, requiredSpace: number): Promise<boolean> {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    return warehouse ? warehouse.availableSpace >= requiredSpace : false;
  }

  async updateAvailableSpace(warehouseId: string, spaceChange: number): Promise<void> {
    await prisma.warehouse.update({ where: { id: warehouseId }, data: { availableSpace: { increment: spaceChange } } });
    
    // Invalidate cache
    await cacheService.invalidateWarehouses();
  }

  // Get warehouses with advanced filtering and sorting
  async searchWarehouses(searchParams: {
    query?: string;
    storageType?: string;
    city?: string;
    state?: string;
    minSpace?: number;
    maxPrice?: number;
    features?: string[];
    sortBy?: 'price' | 'space' | 'name' | 'location';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const {
      query,
      storageType,
      city,
      state,
      minSpace,
      maxPrice,
      features,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20
    } = searchParams;

    const filter: any = { isActive: true };

    // Text search
    if (query) {
      filter.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { location: { contains: query, mode: 'insensitive' } },
        { city: { contains: query, mode: 'insensitive' } }
      ];
    }

    // Filters
    if (storageType) filter.storageType = storageType;
    if (city) filter.city = { contains: city, mode: 'insensitive' };
    if (state) filter.state = { contains: state, mode: 'insensitive' };
    if (minSpace) filter.availableSpace = { gte: minSpace };
    if (maxPrice) filter.pricePerSqFt = { lte: maxPrice };

    // Features filter
    if (features && features.length > 0) {
      filter.AND = features.map(feature => ({
        features: { path: [feature], equals: true }
      }));
    }

    // Sorting
    const orderBy: any = {};
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

    // Pagination
    const skip = (page - 1) * limit;

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where: filter,
        orderBy,
        skip,
        take: limit
      }),
      prisma.warehouse.count({ where: filter })
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

export const warehouseService = new WarehouseService();