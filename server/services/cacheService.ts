export class CacheService {
  // All cache methods are now no-ops

  async get(_key: string): Promise<any> {
    return null;
  }

  async set(_key: string, _value: any, _ttl?: number): Promise<void> {}

  async del(_key: string): Promise<void> {}

  async invalidatePattern(_pattern: string): Promise<void> {}

  async getWarehouses(_filters?: any): Promise<any> {
    return null;
  }

  async setWarehouses(_warehouses: any[], _filters?: any): Promise<void> {}

  async invalidateWarehouses(): Promise<void> {}

  async getUserQuotes(_userId: string): Promise<any> {
    return null;
  }

  async setUserQuotes(_userId: string, _quotes: any[]): Promise<void> {}

  async invalidateUserQuotes(_userId: string): Promise<void> {}
}

export const cacheService = new CacheService();