import { StorageType } from "@prisma/client";
export interface WarehouseFilters {
    city?: string;
    state?: string;
    storageType?: StorageType;
    minSpace?: number;
    maxPrice?: number;
}
export declare class WarehouseService {
    getAllWarehouses(filters?: WarehouseFilters): Promise<any>;
    getWarehouseById(id: string): Promise<{
        id: string;
        name: string;
        location: string;
        city: string;
        state: string;
        storageType: import(".prisma/client").$Enums.StorageType;
        totalSpace: number;
        availableSpace: number;
        pricePerSqFt: number;
        features: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        imageUrl: string | null;
    } | null>;
    getWarehousesByType(storageType: StorageType): Promise<any>;
    getWarehousesByLocation(city: string, state: string): Promise<any>;
    createWarehouse(warehouseData: any): Promise<{
        id: string;
        name: string;
        location: string;
        city: string;
        state: string;
        storageType: import(".prisma/client").$Enums.StorageType;
        totalSpace: number;
        availableSpace: number;
        pricePerSqFt: number;
        features: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        imageUrl: string | null;
    }>;
    updateWarehouse(id: string, updateData: any): Promise<{
        id: string;
        name: string;
        location: string;
        city: string;
        state: string;
        storageType: import(".prisma/client").$Enums.StorageType;
        totalSpace: number;
        availableSpace: number;
        pricePerSqFt: number;
        features: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        imageUrl: string | null;
    }>;
    deleteWarehouse(id: string): Promise<boolean>;
    checkAvailability(warehouseId: string, requiredSpace: number): Promise<boolean>;
    updateAvailableSpace(warehouseId: string, spaceChange: number): Promise<void>;
    searchWarehouses(searchParams: {
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
    }): Promise<{
        warehouses: {
            id: string;
            name: string;
            location: string;
            city: string;
            state: string;
            storageType: import(".prisma/client").$Enums.StorageType;
            totalSpace: number;
            availableSpace: number;
            pricePerSqFt: number;
            features: import("@prisma/client/runtime/library").JsonValue | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            imageUrl: string | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
}
export declare const warehouseService: WarehouseService;
//# sourceMappingURL=warehouseService.d.ts.map