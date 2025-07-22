import { WarehouseModel, type Warehouse, type InsertWarehouse } from "../../shared/schema";
import { cacheService } from "./cacheService";

export interface WarehouseFilters {
  city?: string;
  state?: string;
  storageType?: string;
  minSpace?: number;
  maxPrice?: number;
}

export class WarehouseService {
  async getAllWarehouses(filters?: WarehouseFilters): Promise<Warehouse[]> {
    // Try to get from cache first
    const cached = await cacheService.getWarehouses(filters);
    if (cached) {
      return cached;
    }

    const query: any = { isActive: true };

    if (filters) {
      if (filters.city) query.city = new RegExp(filters.city, 'i');
      if (filters.state) query.state = new RegExp(filters.state, 'i');
      if (filters.storageType) query.storageType = filters.storageType;
      if (filters.minSpace) query.availableSpace = { $gte: filters.minSpace };
      if (filters.maxPrice) query.pricePerSqFt = { $lte: filters.maxPrice };
    }

    const warehouses = await WarehouseModel.find(query).sort({ name: 1 });
    
    // Cache the results
    await cacheService.setWarehouses(warehouses, filters);
    
    return warehouses;
  }

  async getWarehouseById(id: string): Promise<Warehouse | null> {
    return await WarehouseModel.findById(id);
  }

  async getWarehousesByType(storageType: string): Promise<Warehouse[]> {
    return this.getAllWarehouses({ storageType });
  }

  async getWarehousesByLocation(city: string, state: string): Promise<Warehouse[]> {
    return this.getAllWarehouses({ city, state });
  }

  async createWarehouse(warehouseData: InsertWarehouse): Promise<Warehouse> {
    const warehouse = new WarehouseModel(warehouseData);
    const savedWarehouse = await warehouse.save();
    
    // Invalidate cache
    await cacheService.invalidateWarehouses();
    
    return savedWarehouse;
  }

  async updateWarehouse(id: string, updateData: Partial<Warehouse>): Promise<Warehouse | null> {
    const warehouse = await WarehouseModel.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
    
    if (warehouse) {
      // Invalidate cache
      await cacheService.invalidateWarehouses();
    }
    
    return warehouse;
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    const result = await WarehouseModel.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );
    
    if (result) {
      // Invalidate cache
      await cacheService.invalidateWarehouses();
      return true;
    }
    
    return false;
  }

  async checkAvailability(warehouseId: string, requiredSpace: number): Promise<boolean> {
    const warehouse = await this.getWarehouseById(warehouseId);
    return warehouse ? warehouse.availableSpace >= requiredSpace : false;
  }

  async updateAvailableSpace(warehouseId: string, spaceChange: number): Promise<void> {
    await WarehouseModel.findByIdAndUpdate(
      warehouseId,
      { $inc: { availableSpace: spaceChange } }
    );
    
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
      filter.$or = [
        { name: new RegExp(query, 'i') },
        { location: new RegExp(query, 'i') },
        { city: new RegExp(query, 'i') }
      ];
    }

    // Filters
    if (storageType) filter.storageType = storageType;
    if (city) filter.city = new RegExp(city, 'i');
    if (state) filter.state = new RegExp(state, 'i');
    if (minSpace) filter.availableSpace = { $gte: minSpace };
    if (maxPrice) filter.pricePerSqFt = { $lte: maxPrice };

    // Features filter
    if (features && features.length > 0) {
      const featureQueries = features.map(feature => ({
        [`features.${feature}`]: true
      }));
      filter.$and = featureQueries;
    }

    // Sorting
    const sortOptions: any = {};
    switch (sortBy) {
      case 'price':
        sortOptions.pricePerSqFt = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'space':
        sortOptions.availableSpace = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'location':
        sortOptions.city = sortOrder === 'asc' ? 1 : -1;
        sortOptions.state = sortOrder === 'asc' ? 1 : -1;
        break;
      default:
        sortOptions.name = sortOrder === 'asc' ? 1 : -1;
    }

    // Pagination
    const skip = (page - 1) * limit;

    const [warehouses, total] = await Promise.all([
      WarehouseModel.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      WarehouseModel.countDocuments(filter)
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