import TMap from "../../Struct/TMap";
import { Pool } from "./Pool";
import FunctionWrapper, { functionWrapper } from "../../Struct/FunctionWrapper";

export default class PoolManager {

    private static _instance: PoolManager = null;

    static instance(): PoolManager {
        if (!this._instance)
            this._instance = new PoolManager();
        return this._instance;
    }

    protected _poolMap: TMap<string, Pool>;

    private constructor() {
    }

    init() {
        this._poolMap = new TMap<string, Pool>();
    }

    /**
     * 
     * @param poolName 
     */
    public hasRegisterPool(poolName: string): boolean {
        return this.getPool(poolName) != null;
    }

    /**
     * 
     * @param className 
     * @param itemClass 
     * @param countLimit 
     * @param expiredTime 
     */
    public registerPool(className: string, itemClass: any, countLimit: number = 32, expiredTime?: number): Pool {
        return this.register(className, functionWrapper(function (itemConstructor: any): any {
            return new itemConstructor();
        }, null, itemClass), countLimit, expiredTime);
    }

    /**
     * 
     * @param prefab 
     * @param maxCapacity 
     * @param expiredTime 
     */
    public registerPrefabPool(prefab: cc.Prefab, maxCapacity: number = 32, expiredTime: number = 60): Pool {
        // this._assetManager.regitserStaticAsset( prefab );
        return this.register(prefab.name, new FunctionWrapper(function (prefab: cc.Prefab) {
            return cc.instantiate(prefab);
        }, null, prefab), maxCapacity, expiredTime);
    }

    /**
     * 
     * @param name 
     * @param createHandler 
     * @param countLimit 
     * @param expiredTime 
     */
    private register(name: string, createHandler: FunctionWrapper<(...params: any[]) => any>, countLimit: number = 32, expiredTime?: number): Pool {
        this.unRegisterPool(name);
        let pool = new Pool(name, createHandler, countLimit, expiredTime);
        this._poolMap.set(name, pool);
        return pool;
    }

    /**
     * 
     * @param name 
     */
    public unRegisterPool(name: string): void {
        let pool = this._poolMap.get(name);
        if (pool) {
            pool.clear();
            this._poolMap.remove(name);
        }
    }

    /**
     * Parse pool
     * @param item
     * @return {string}
     */
    public parsePoolNameWithItem(item: any): string {
        let poolName: string;
        if (item instanceof cc.Component) {
            poolName = item.node.name;
        }
        else if (item.constructor) {
            poolName = item.constructor.name;
        }
        return poolName;
    }

    /**
     * 
     * @param name 
     */
    public getPool(name: string): Pool {
        return this._poolMap.get(name);
    }

    /**
     * 
     * @param item 
     * @param poolName 
     */
    public push(item: any, poolName?: string): boolean {
        if (!poolName) {
            poolName = this.parsePoolNameWithItem(item);
        }
        let pool = this.getPool(poolName);
        if (pool) {
            pool.push(item);
            return true;
        }
        return false;
    }

    /**
     * 
     * @param items 
     * @param poolName 
     */
    public pushArray(items: any[], poolName?: string): boolean {
        if (!items || items.length == 0)
            return false;
        if (!poolName) {
            poolName = this.parsePoolNameWithItem(items[0]);
        }
        let pool = this.getPool(poolName);
        if (pool) {
            pool.pushArray(items);
            return true;
        }
        return false;
    }

    /**
     * 
     * @param poolName 
     * @param params 
     */
    public pop(poolName: string, ...params: any[]): any {
        let pool = this.getPool(poolName);
        if (pool) {
            return pool.pop.apply(pool, params);
        }
        return null;
    }

    /**
     * 
     * @param poolName 
     */
    public clearPool(poolName: string): void {
        let pool = this.getPool(poolName);
        if (pool) {
            pool.clear();
        }
    }
}

export var pool = PoolManager.instance();