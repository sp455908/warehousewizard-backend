export declare class CacheService {
    get(_key: string): Promise<any>;
    set(_key: string, _value: any, _ttl?: number): Promise<void>;
    del(_key: string): Promise<void>;
    invalidatePattern(_pattern: string): Promise<void>;
    getWarehouses(_filters?: any): Promise<any>;
    setWarehouses(_warehouses: any[], _filters?: any): Promise<void>;
    invalidateWarehouses(): Promise<void>;
    getUserQuotes(_userId: string): Promise<any>;
    setUserQuotes(_userId: string, _quotes: any[]): Promise<void>;
    invalidateUserQuotes(_userId: string): Promise<void>;
}
export declare const cacheService: CacheService;
//# sourceMappingURL=cacheService.d.ts.map