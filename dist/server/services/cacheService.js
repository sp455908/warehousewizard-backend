"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
class CacheService {
    async get(_key) {
        return null;
    }
    async set(_key, _value, _ttl) { }
    async del(_key) { }
    async invalidatePattern(_pattern) { }
    async getWarehouses(_filters) {
        return null;
    }
    async setWarehouses(_warehouses, _filters) { }
    async invalidateWarehouses() { }
    async getUserQuotes(_userId) {
        return null;
    }
    async setUserQuotes(_userId, _quotes) { }
    async invalidateUserQuotes(_userId) { }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
//# sourceMappingURL=cacheService.js.map