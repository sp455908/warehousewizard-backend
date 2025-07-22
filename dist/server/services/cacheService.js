"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const database_1 = require("../config/database");
class CacheService {
    constructor() {
        this.defaultTTL = 3600;
        this.redis = (0, database_1.getRedisClient)();
    }
    async get(key) {
        if (!this.redis)
            return null;
        try {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        }
        catch (error) {
            console.error("Cache get error:", error);
            return null;
        }
    }
    async set(key, value, ttl = this.defaultTTL) {
        if (!this.redis)
            return;
        try {
            await this.redis.setEx(key, ttl, JSON.stringify(value));
        }
        catch (error) {
            console.error("Cache set error:", error);
        }
    }
    async del(key) {
        if (!this.redis)
            return;
        try {
            await this.redis.del(key);
        }
        catch (error) {
            console.error("Cache delete error:", error);
        }
    }
    async invalidatePattern(pattern) {
        if (!this.redis)
            return;
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
        }
        catch (error) {
            console.error("Cache invalidate pattern error:", error);
        }
    }
    async getWarehouses(filters) {
        const key = `warehouses:${JSON.stringify(filters || {})}`;
        return this.get(key);
    }
    async setWarehouses(warehouses, filters) {
        const key = `warehouses:${JSON.stringify(filters || {})}`;
        await this.set(key, warehouses, 1800);
    }
    async invalidateWarehouses() {
        await this.invalidatePattern("warehouses:*");
    }
    async getUserQuotes(userId) {
        return this.get(`quotes:user:${userId}`);
    }
    async setUserQuotes(userId, quotes) {
        await this.set(`quotes:user:${userId}`, quotes, 600);
    }
    async invalidateUserQuotes(userId) {
        await this.del(`quotes:user:${userId}`);
    }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
//# sourceMappingURL=cacheService.js.map