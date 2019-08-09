import { timer } from "../Time/TimerManager";
import { functionWrapper } from "../../Struct/FunctionWrapper";
import Dictionary from "../../Struct/Dictionary";

export const enum CacheExpirationStrategy {
    //下一帧就过期
    NextFrame = 0,
    //永不过期
    Never = 1,
    //一段时间后过期(毫秒)
    Timeout = 2,
    //超过一定访问次数过期
    Read_Times = 3,
    //某个指定的时间过期(毫秒)
    Timestamp = 4,
    //超过一定时间无访问则过期
    NO_VIIST_TIMEOUT = 4,

}

const Event_Expiration = "data-expiration";

export class BaseDataExpirationStrategy extends cc.EventTarget {
    protected mKey: string;
    protected mExpirationCB: (key: string) => void;

    protected mTimerID: number;


    constructor(cb?: (key: string) => void) {
        super();

        this.mExpirationCB = cb;
    }

    protected setTimeout(timeout: number) {
        if (this.mTimerID >= 0) {
            timer.removeListener(this.mTimerID);
        }
        this.mTimerID = timer.setTimeout(functionWrapper(this.onTimeout, this), timeout);
    }
    protected onTimeout() {
        this.mTimerID = -1;
        this.onExpiration();
    }
    public onRead() {

    }
    public onWrite() {

    }
    protected stopTimeout() {
        if (this.mTimerID >= 0) {
            timer.removeListener(this.mTimerID);
            this.mTimerID = -1;
        }
    }
    public stop() {
        this.mKey = null;
        this.mExpirationCB = null;
        this.stopTimeout();
    }

    checkExpiration(): boolean {
        return false;
    }
    protected onExpiration() {
        this.stopTimeout();
        (this.mKey && this.mKey.length > 0) && this.emit(Event_Expiration, this.mKey);
        if (this.mExpirationCB) {
            this.mExpirationCB(this.mKey);
        }
    }
}

export class DataExpirationStrategyGroup extends BaseDataExpirationStrategy {
    protected mStrategryList: Array<BaseDataExpirationStrategy>;
    protected mIsAnd: boolean;
    constructor(childList: Array<BaseDataExpirationStrategy>, isAnd: boolean, cb?: (key: string) => void) {
        super(cb);
        this.mIsAnd = isAnd;
        this.mStrategryList = childList ? childList : [];
    }
    public stop() {
        super.stop();
        for (let i in this.mStrategryList) {
            this.mStrategryList[i].stop();
            this.mStrategryList[i].off(Event_Expiration, this.onChildExpiration, this);
        }
        this.mStrategryList.splice(0, this.mStrategryList.length);
    }
    protected onChildExpiration(child: BaseDataExpirationStrategy) {
        if (this.checkExpiration()) {
            this.onExpiration();
        }
    }
    public addChild(strategy: BaseDataExpirationStrategy) {
        strategy.on(Event_Expiration, this.onChildExpiration, this);
        this.mStrategryList.push(strategy);
    }
    public removeChild(strategy: BaseDataExpirationStrategy) {
        let index = this.mStrategryList.indexOf(strategy);
        if (index >= 0) {
            strategy.off(Event_Expiration, this.onChildExpiration, this);
            this.mStrategryList.splice(index, 1);
        }
    }
    public checkExpiration() {
        if (this.mIsAnd) {
            let result = this.mStrategryList.length > 0;
            for (let i = 0, len = this.mStrategryList.length; i < len; i++) {
                let item = this.mStrategryList[i];
                let childResult = item.checkExpiration();
                if (!childResult) {
                    result = false;
                    break;
                }
            }
            return result;
        }
        else {
            let result = false;
            for (let i = 0, len = this.mStrategryList.length; i < len; i++) {
                let item = this.mStrategryList[i];
                let childResult = item.checkExpiration();
                if (childResult) {
                    result = true;
                    break;
                }
            }
            return result;
        }
    }
}
export class NextFrameExpiration extends BaseDataExpirationStrategy {
    protected mIsExpiration: boolean;
    constructor(cb?: (key: string) => void) {
        super(cb);
        this.mIsExpiration = false;
        this.mTimerID = timer.addNextFrameListener(functionWrapper(this.onTimeout, this));
    }

    protected onTimeout() {
        this.mIsExpiration = true;
        super.onTimeout();
    }

    public checkExpiration(): boolean {
        return this.mIsExpiration;
    }
}

export class NeverFrameExpiration extends BaseDataExpirationStrategy {
    constructor() {
        super(null);
    }
    public checkExpiration(): boolean {
        return false;
    }
}

export class TimeoutExpiration extends BaseDataExpirationStrategy {
    constructor(timeout: number, cb?: (key: string) => void) {
        super(cb);
        this.setTimeout(timeout);
    }
}

export class TimestampExpiration extends BaseDataExpirationStrategy {
    protected mTimerID: number;
    constructor(timestamp: number, cb?: (key: string) => void) {
        super(cb);
        let currTime = cc.sys.now();
        let timeout = Math.max(timestamp - currTime, 10);
        this.setTimeout(timeout);
    }
}

export class ReadTimesExpiration extends BaseDataExpirationStrategy {
    protected mOverReadTimes: number;
    constructor(readTimes: number, cb?: (key: string) => void) {
        super(cb);
        this.mOverReadTimes = Math.max(readTimes, 1);
    }
    public onRead() {
        this.mOverReadTimes--;
        if (this.mOverReadTimes <= 0) {
            this.onExpiration();
        }
    }
}

export class NoReadTimeoutExpiration extends BaseDataExpirationStrategy {
    protected mTimeout: number;
    protected mTimerID: number;
    constructor(timeout: number, cb?: (key: string) => void) {
        super(cb);
        this.mTimeout = timeout;
        this.setTimeout(this.mTimeout);
    }
    public onRead() {
        super.onRead();
        this.stopTimeout();
        this.setTimeout(this.mTimeout);
    }
}

export class NoWriteTimeoutExpiration extends BaseDataExpirationStrategy {
    protected mTimeout: number;
    protected mTimerID: number;
    constructor(timeout: number, cb?: (key: string) => void) {
        super(cb);
        this.mTimeout = timeout;
        this.setTimeout(this.mTimeout);
    }
    public onWrite() {
        super.onWrite();
        this.stopTimeout();
        this.setTimeout(this.mTimeout);
    }
}

class CacheDataItem {
    protected _value: any;
    public expirationStrategy: BaseDataExpirationStrategy;
    constructor(value: any, strategy: BaseDataExpirationStrategy) {

        this.expirationStrategy = strategy;
        this.value = value;
    }
    public set value(value: any) {
        this._value = value;
        if (this.expirationStrategy) {
            this.expirationStrategy.onWrite();
        }
    }
    public get value() {
        if (this.expirationStrategy) {
            this.expirationStrategy.onRead();
        }
        return this._value;
    }
    public checkExpiration() {
        return this.expirationStrategy && this.expirationStrategy.checkExpiration();
    }
}


export default class CachePool extends cc.EventTarget {
    private static _instance: CachePool = null;

    static instance():CachePool {
        if (!this._instance)
            this._instance = new CachePool();
        return this._instance;
    }

    //有数据项过期
    public static Event_Data_Expiration = "Event_Data_Expiration";
    protected _dataPool: Dictionary;
    constructor() {
        super();
    }

    init() {
        this._dataPool = new Dictionary();
    }

    update(key: string, data: any) {
        let dataItem: CacheDataItem = this._dataPool.get(key);
        if (dataItem) {
            dataItem.value = data;
        }
    }
    set(key: string, data: any, strategy: BaseDataExpirationStrategy) {
        let dataItem: CacheDataItem = this._dataPool.get(key);
        if (dataItem) {
            if (dataItem.expirationStrategy) {
                dataItem.expirationStrategy.stop();
                dataItem.expirationStrategy.off(Event_Expiration, this.onDataExpiration, this);
            }
            dataItem.expirationStrategy = strategy;
            dataItem.value = data;
        }
        else {
            dataItem = new CacheDataItem(data, strategy);
            this._dataPool.set(key, data);
        }
        if (dataItem.expirationStrategy) {
            dataItem.expirationStrategy["mKey"] = key;
            dataItem.expirationStrategy.on(Event_Expiration, this.onDataExpiration, this);
        }
    }

    get(key: string) {
        let item: CacheDataItem = this._dataPool.get(key);
        if (item) {
            return item.value;
        }
        return null;
    }

    delete(key: string) {
        let item: CacheDataItem = this._dataPool.get(key);
        if (item && item.expirationStrategy) {
            item.expirationStrategy.off(Event_Expiration, this.onDataExpiration, this);
            item.expirationStrategy.stop();
        }
        this._dataPool.delete(key);
    }

    expirationData(key: string) {
        this.onDataExpiration(key);
    }

    protected onDataExpiration(key: string) {
        let item: CacheDataItem = this._dataPool.get(key);
        if (item && item.expirationStrategy) {
            item.expirationStrategy.off(Event_Expiration, this.onDataExpiration, this);
            item.expirationStrategy.stop();
        }
        this._dataPool.delete(key);
        this.emit(CachePool.Event_Data_Expiration, key, item.value);
    }
}

export var cache = CachePool.instance();