export declare class CacheService {
    private redis;
    private defaultTTL;
    constructor();
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    invalidatePattern(pattern: string): Promise<void>;
    getWarehouses(filters?: any): Promise<any>;
    setWarehouses(warehouses: any[], filters?: any): Promise<void>;
    invalidateWarehouses(): Promise<void>;
    getUserQuotes(userId: string): Promise<any>;
    setUserQuotes(userId: string, quotes: any[]): Promise<void>;
    invalidateUserQuotes(userId: string): Promise<void>;
}
export declare const cacheService: CacheService;
//# sourceMappingURL=cacheService.d.ts.map