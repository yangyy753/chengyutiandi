import FunctionWrapper from "../../Struct/FunctionWrapper";
import { TimerIntervalListener, timer } from "../Time/TimerManager";

/**
 * Object buffer pool, you can choose the maximum number limit and timeout invalidation policy. 
 * If you pass in itemClass, you create a new one when you can't get the cache.
 */
export class Pool {
    private mItemCache: Array<{ item: any, time: number }>;
    private mMaxCapacity: number;
    private mCurrCount: number;
    private _expiredTimeLimit: number;
    private _CurrClassName: string;
    private _createHandler: FunctionWrapper<(...params: any[]) => any>;
    _name: string;
    /**
     * @param maxCapacity If the maximum capacity of the buffer pool exceeds that capacity, it will be discarded directly at push, and 0 means infinite.
     * @param itemClass The constructor class of the buffer object, if null, cannot automatically create a new object at pop time
     * @param expiredTime Expiration time (seconds), default 1 minute is not used to destroy. 0 means no expiration
     */
    constructor(name: string, createHandler: FunctionWrapper<(...params: any[]) => any>, maxCapacity: number = 32, expiredTime: number = 60) {
        this._name = name;
        this._createHandler = createHandler;
        this.mMaxCapacity = maxCapacity;
        this.mItemCache = new Array<{ item: any, time: number }>(Math.max(maxCapacity, 32));
        this.mCurrCount = 0;
        this._expiredTimeLimit = expiredTime;
    }
    set expiredTimeLimit(value: number) {
        this._expiredTimeLimit = value;
        if (this._expiredTimeLimit > 0) {
            if (this.mCurrCount > 0)
                this._startTimer();
        }
        else {
            this._stopTimer();
        }
    }
    get expiredTimeLimit() {
        return this._expiredTimeLimit;
    }
    protected _startTimer(): void {

        if (!timer.hasListener("Pool<" + this._name + ">_expired")) {
            timer.addTimerListener(1000, 0, new FunctionWrapper<TimerIntervalListener>(this._onExpiredTimerInterval, this), null, "Pool<" + this._name + ">_expired");
        }
    }
    protected _stopTimer(): void {
        timer.removeListener("Pool<" + this._CurrClassName + ">_expired");  //`Pool<${this._CurrClassName}>_expired`
    }
    private _onExpiredTimerInterval(tiggerCount: number, totalDuration: number, ...params: any[]): void {
        if (this._expiredTimeLimit <= 0 || this.mCurrCount == 0) {
            return;
        }
        let currTime = new Date().getTime();
        let oldLength = this.mItemCache.length;
        let validCount = this.mCurrCount;
        for (let i = validCount - 1; i >= 0; i--) {
            let item = this.mItemCache[i];
            if (!item || !item.item) {
                continue;
            }
            if (currTime - item.time >= this._expiredTimeLimit * 1000) {
                if (item.item && item.item.destroy)
                    item.item.destroy();
                item.item = null;

                this.mItemCache.splice(i, 1);
                this.mCurrCount--;
            }
        }

        this.mItemCache.length = oldLength;
        if (this.mCurrCount == 0) {
            this._stopTimer();
        }
    }

    /**
     * Buffer an object into the pool and discard it if it exceeds the upper limit of the pool
     * @param items Buffer object
     */
    public push(...items: any[]): void {
        this.pushArray(items);
    }
    public pushArray(items: any[]): void {
        if (!items || items.length == 0)
            return;
        let currTime = new Date().getTime();
        let lastCount = this.mCurrCount;

        for (let i = 0, len = items.length; i < len; i++) {
            let item = items[i];
            if (!item)
                continue;
            item.unuse && item.unuse();
            if (this.mMaxCapacity > 0 && this.mCurrCount >= this.mMaxCapacity) {
                item.destory && item.destory();

                continue;
            }

            if (this.mItemCache.length <= this.mCurrCount) {
                this.mItemCache.length = this.mItemCache.length + 32;
            }
            if (!this.mItemCache[this.mCurrCount]) {
                this.mItemCache[this.mCurrCount] = { item: item, time: currTime };
            }
            else {
                this.mItemCache[this.mCurrCount].item = item;
                this.mItemCache[this.mCurrCount].time = currTime;
            }

            this.mCurrCount++;
        }
        if (lastCount == 0 && this.mCurrCount > 0 && this._expiredTimeLimit > 0) {
            this._startTimer();
        }
    }

    /**
     * Take an object out of the pool. Returns the cache if it exists in the pool, or creates a new (if a constructor class exists)
     */
    public pop(...params: any[]): any {
        let item: any;
        let lastCount = this.mCurrCount;
        if (this.mCurrCount > 0) {
            this.mCurrCount--;
            item = this.mItemCache[this.mCurrCount].item;
            this.mItemCache[this.mCurrCount].item = null;
        }
        else {
            if (this._createHandler) {
                item = this._createHandler.execute();
            }
        }
        if (!item) {
            console.error("pop is null")
        }
        if (item.reuse) {
            item.reuse.apply(item, params);
        }

        if (lastCount > 0 && this.mCurrCount == 0 && this._expiredTimeLimit > 0) {
            this._stopTimer();
        }
        return item;
    }

    /**
     * Clear pool
     */
    public clear(): void {
        if (this.mCurrCount > 0) {
            for (let i = 0; i < this.mCurrCount; i++) {
                let item = this.mItemCache[i];
                if (item) {
                    item.item.destory && item.item.destory();
                    this.mItemCache[i].item = null;
                }
            }
            this.mCurrCount = 0;
        }
        this.mItemCache.length = Math.max(this.mMaxCapacity, 32);
        if (this._expiredTimeLimit > 0) {
            this._stopTimer();
        }
    }

    /**
     * Get max capacity
     */
    get maxCapacity() {
        return this.mMaxCapacity;
    }

    /**
     * Resetting the maximum capacity, if 0, means infinite
     */
    set maxCapacity(value: number) {
        this.mMaxCapacity = value;
        if (this.mMaxCapacity > 0) {
            this.mItemCache.length = this.mMaxCapacity;
            if (this.mCurrCount > this.mMaxCapacity) {
                this.mCurrCount = this.mMaxCapacity;
            }
        }
    }
}
