import { cacheService } from "./cacheService";
import { prisma } from "../config/prisma";
import { StorageType } from "@prisma/client";

export interface WarehouseFilters {
  city?: string;
  state?: string;
  storageType?: StorageType;
  minSpace?: number;
  maxPrice?: number;
  isActive?: boolean;
  ownerId?: string;
}

export class WarehouseService {
  async getAllWarehouses(filters?: WarehouseFilters, excludePricing: boolean = true) {
    console.log("[WarehouseService] getAllWarehouses called with filters:", filters, "excludePricing:", excludePricing);
    
    // Try to get from cache first
    const cached = await cacheService.getWarehouses(filters);
    if (cached) {
      console.log("[WarehouseService] Returning cached warehouses:", cached.length);
      return cached;
    }

    // Try flexible search strategy for better warehouse matching
    let warehouses = await this.searchWarehousesFlexible(filters, excludePricing);
    
    console.log("[WarehouseService] Found warehouses:", warehouses.length);
    console.log("[WarehouseService] Warehouse details:", warehouses.map(w => ({ id: w.id, name: w.name, isActive: w.isActive })));
    
    // Cache the results
    await cacheService.setWarehouses(warehouses, filters);
    
    return warehouses;
  }

  private async searchWarehousesFlexible(filters?: WarehouseFilters, excludePricing: boolean = true) {
    const baseWhere: any = {};
    
    // Always filter by isActive unless explicitly overridden
    if (filters && filters.hasOwnProperty('isActive')) {
      baseWhere.isActive = filters.isActive;
    } else {
      baseWhere.isActive = true; // Default to active warehouses
    }

    // Strategy 1: Try exact match (location + storage type)
    if (filters && (filters.city || filters.state || filters.storageType)) {
      const exactWhere = { ...baseWhere };
      if (filters.city) exactWhere.city = { contains: filters.city, mode: 'insensitive' };
      if (filters.state) exactWhere.state = { contains: filters.state, mode: 'insensitive' };
      if (filters.storageType) exactWhere.storageType = filters.storageType;
      if (filters.minSpace) exactWhere.availableSpace = { gte: filters.minSpace };
      if (filters.maxPrice) exactWhere.pricePerSqFt = { lte: filters.maxPrice };
      if (filters.ownerId) exactWhere.ownerId = filters.ownerId;

      console.log("[WarehouseService] Strategy 1 - Exact match where clause:", exactWhere);
      let warehouses = await this.executeWarehouseQuery(exactWhere, excludePricing);
      
      if (warehouses.length > 0) {
        console.log("[WarehouseService] Strategy 1 found", warehouses.length, "warehouses");
        return warehouses;
      }
    }

    // Strategy 2: Try storage type only (ignore location)
    if (filters && filters.storageType) {
      const typeWhere = { ...baseWhere };
      typeWhere.storageType = filters.storageType;
      if (filters.minSpace) typeWhere.availableSpace = { gte: filters.minSpace };
      if (filters.maxPrice) typeWhere.pricePerSqFt = { lte: filters.maxPrice };
      if (filters.ownerId) typeWhere.ownerId = filters.ownerId;

      console.log("[WarehouseService] Strategy 2 - Storage type only where clause:", typeWhere);
      let warehouses = await this.executeWarehouseQuery(typeWhere, excludePricing);
      
      if (warehouses.length > 0) {
        console.log("[WarehouseService] Strategy 2 found", warehouses.length, "warehouses");
        return warehouses;
      } else {
        console.log("[WarehouseService] Strategy 2 - No warehouses found for storage type:", filters.storageType);
      }
    }

    // Strategy 3: Try location only (ignore storage type)
    if (filters && (filters.city || filters.state)) {
      const locationWhere = { ...baseWhere };
      if (filters.city) locationWhere.city = { contains: filters.city, mode: 'insensitive' };
      if (filters.state) locationWhere.state = { contains: filters.state, mode: 'insensitive' };
      if (filters.minSpace) locationWhere.availableSpace = { gte: filters.minSpace };
      if (filters.maxPrice) locationWhere.pricePerSqFt = { lte: filters.maxPrice };
      if (filters.ownerId) locationWhere.ownerId = filters.ownerId;

      console.log("[WarehouseService] Strategy 3 - Location only where clause:", locationWhere);
      let warehouses = await this.executeWarehouseQuery(locationWhere, excludePricing);
      
      if (warehouses.length > 0) {
        console.log("[WarehouseService] Strategy 3 found", warehouses.length, "warehouses");
        return warehouses;
      }
    }

    // Strategy 4: Show all available warehouses (only basic filters)
    const fallbackWhere = { ...baseWhere };
    if (filters) {
      if (filters.minSpace) fallbackWhere.availableSpace = { gte: filters.minSpace };
      if (filters.maxPrice) fallbackWhere.pricePerSqFt = { lte: filters.maxPrice };
      if (filters.ownerId) fallbackWhere.ownerId = filters.ownerId;
    }

    console.log("[WarehouseService] Strategy 4 - Fallback where clause:", fallbackWhere);
    let warehouses = await this.executeWarehouseQuery(fallbackWhere, excludePricing);
    console.log("[WarehouseService] Strategy 4 found", warehouses.length, "warehouses");
    
    // Log available storage types for debugging
    if (warehouses.length > 0) {
      const availableTypes = [...new Set(warehouses.map(w => w.storageType))];
      console.log("[WarehouseService] Available storage types in system:", availableTypes);
    }
    
    return warehouses;
  }

  private async executeWarehouseQuery(where: any, excludePricing: boolean) {
    if (excludePricing) {
      return await prisma.warehouse.findMany({ 
        where, 
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          location: true,
          city: true,
          state: true,
          storageType: true,
          totalSpace: true,
          availableSpace: true,
          // Exclude pricePerSqFt for public access
          features: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          imageUrl: true
        }
      });
    } else {
      return await prisma.warehouse.findMany({ where, orderBy: { name: 'asc' } });
    }
  }

  async getWarehouseById(id: string) {
    return await prisma.warehouse.findUnique({ where: { id } });
  }

  async getAvailableStorageTypes() {
    const storageTypes = await prisma.warehouse.findMany({
      where: { isActive: true },
      select: { storageType: true },
      distinct: ['storageType']
    });
    return storageTypes.map(w => w.storageType);
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
      features: warehouseData.features || [], // Store as array of strings
      imageUrl: warehouseData.imageUrl || null,
      isActive: warehouseData.isActive ?? true,
      ownerId: warehouseData.ownerId || null, // Include ownerId field
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

  async deleteWarehouse(id: string): Promise<{ success: boolean; deleted: boolean; reason?: string }> {
    try {
      // First, check what related records exist
      const relatedRecords = {
        bookings: await prisma.booking.count({ where: { warehouseId: id } }),
        quotes: await prisma.quote.count({ where: { warehouseId: id } }),
        rfqs: await prisma.rFQ.count({ where: { warehouseId: id } }),
        deliveryOrders: await prisma.deliveryOrder.count({ where: { warehouseId: id } }),
        deliveryReports: await prisma.deliveryReport.count({ where: { warehouseId: id } }),
        cartingDetails: await prisma.cartingDetail.count({ where: { warehouseId: id } }),
        rates: await prisma.rate.count({ where: { warehouseId: id } }),
      };

      const totalRelated = Object.values(relatedRecords).reduce((sum, count) => sum + count, 0);
      
      console.log(`Deleting warehouse ${id} with ${totalRelated} related records:`, relatedRecords);

      // Update quotes to remove warehouse reference (quotes have nullable warehouseId)
      if (relatedRecords.quotes > 0) {
        await prisma.quote.updateMany({
          where: { warehouseId: id },
          data: { warehouseId: null }
        });
      }

      // For models with non-nullable warehouseId, we need to delete the records
      // as they cannot exist without a warehouse reference
      
      // Delete rates first (they reference RFQs)
      if (relatedRecords.rates > 0) {
        await prisma.rate.deleteMany({
          where: { warehouseId: id }
        });
      }

      // Delete RFQs
      if (relatedRecords.rfqs > 0) {
        await prisma.rFQ.deleteMany({
          where: { warehouseId: id }
        });
      }

      // Delete carting details
      if (relatedRecords.cartingDetails > 0) {
        await prisma.cartingDetail.deleteMany({
          where: { warehouseId: id }
        });
      }

      // Delete delivery reports
      if (relatedRecords.deliveryReports > 0) {
        await prisma.deliveryReport.deleteMany({
          where: { warehouseId: id }
        });
      }

      // Delete delivery orders
      if (relatedRecords.deliveryOrders > 0) {
        await prisma.deliveryOrder.deleteMany({
          where: { warehouseId: id }
        });
      }

      // Delete bookings (this will cascade to related records)
      if (relatedRecords.bookings > 0) {
        await prisma.booking.deleteMany({
          where: { warehouseId: id }
        });
      }

      // Now delete the warehouse itself
      const deletedWarehouse = await prisma.warehouse.delete({ where: { id } });
      
      if (deletedWarehouse) {
        // Invalidate cache
        await cacheService.invalidateWarehouses();
        
        const message = totalRelated > 0 
          ? `Warehouse deleted successfully. ${totalRelated} related records were preserved with warehouse reference removed.`
          : "Warehouse deleted successfully.";
          
        console.log(message);
        
        return { 
          success: true, 
          deleted: true, 
          reason: totalRelated > 0 ? "Related records preserved" : undefined 
        };
      }
      
      return { success: false, deleted: false };
    } catch (error) {
      console.error("Error deleting warehouse:", error);
      return { success: false, deleted: false };
    }
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