import { QuoteStatus } from "@prisma/client";
export interface QuoteFilters {
    customerId?: string;
    status?: QuoteStatus;
    assignedTo?: string;
    warehouseId?: string;
    storageType?: string;
}
export declare class QuoteService {
    createQuote(quoteData: any): Promise<{
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    }>;
    getQuoteById(id: string): Promise<({
        warehouse: {
            id: string;
            name: string;
            location: string;
            city: string;
            state: string;
        } | null;
        customer: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            company: string | null;
        };
        assignedToUser: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        } | null;
    } & {
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    }) | null>;
    getQuotesByCustomer(customerId: string): Promise<any>;
    getQuotesByStatus(status: QuoteStatus): Promise<({
        warehouse: {
            id: string;
            name: string;
            location: string;
            city: string;
            state: string;
        } | null;
        customer: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            company: string | null;
        };
        assignedToUser: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        } | null;
    } & {
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    })[]>;
    getQuotesByAssignee(assignedTo: string): Promise<({
        warehouse: {
            id: string;
            name: string;
            location: string;
            city: string;
            state: string;
        } | null;
        customer: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            company: string | null;
        };
    } & {
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    })[]>;
    updateQuote(id: string, updateData: any): Promise<{
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    }>;
    assignQuote(id: string, assignedTo: string): Promise<{
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    }>;
    approveQuote(id: string, finalPrice: number, warehouseId?: string): Promise<{
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    }>;
    rejectQuote(id: string, reason?: string): Promise<{
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    }>;
    getQuotesForWarehouse(warehouseId: string): Promise<({
        customer: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            company: string | null;
        };
    } & {
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    })[]>;
    searchQuotes(filters: QuoteFilters & {
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        quotes: ({
            warehouse: {
                id: string;
                name: string;
                location: string;
                city: string;
                state: string;
            } | null;
            customer: {
                id: string;
                email: string;
                firstName: string;
                lastName: string;
                company: string | null;
            };
            assignedToUser: {
                id: string;
                email: string;
                firstName: string;
                lastName: string;
            } | null;
        } & {
            id: string;
            storageType: string;
            createdAt: Date;
            updatedAt: Date;
            requiredSpace: number;
            customerId: string;
            preferredLocation: string;
            duration: string;
            specialRequirements: string | null;
            status: import(".prisma/client").$Enums.QuoteStatus;
            assignedTo: string | null;
            finalPrice: number | null;
            warehouseId: string | null;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    getQuotesForRole(role: string, userId?: string): Promise<({
        warehouse: {
            id: string;
            name: string;
            location: string;
            city: string;
            state: string;
        } | null;
        customer: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            company: string | null;
        };
    } & {
        id: string;
        storageType: string;
        createdAt: Date;
        updatedAt: Date;
        requiredSpace: number;
        customerId: string;
        preferredLocation: string;
        duration: string;
        specialRequirements: string | null;
        status: import(".prisma/client").$Enums.QuoteStatus;
        assignedTo: string | null;
        finalPrice: number | null;
        warehouseId: string | null;
    })[]>;
    calculateQuotePrice(quoteId: string): Promise<number | null>;
}
export declare const quoteService: QuoteService;
//# sourceMappingURL=quoteService.d.ts.map