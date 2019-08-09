import FunctionWrapper from "../../Struct/FunctionWrapper";
import Map from "../../Struct/Dictionary";
import { Timer } from "./Timer";
import CommonUtils from "../utils/CommonUtils";
import { pool } from "../Pool/PoolManager";

export type TimerIntervalListener = (tiggerCount: number, totalDuration: number, ...params: any[]) => void
export type TimerComplpeteListener = (...params: any[]) => void;

export default class TimerManager {
    private static _instance: TimerManager = null;

    static instance():TimerManager {
        if (!this._instance)
            this._instance = new TimerManager();
        return this._instance;
    }

    protected _TotalTimerMap: Map;
    protected _CurrFrameCompleteTimers: Array<string>;

    private constructor() {
        this._TotalTimerMap = new Map();
        this._CurrFrameCompleteTimers = [];
    }

    init() {
        pool.registerPool("Timer", Timer);
    }

    /**
     * 
     * @param dt 
     */
    public update(dt: number): void {
        let timeLen = this._TotalTimerMap.size;
        if (timeLen == 0) return;

        let keyList = this._TotalTimerMap.keys;
        for (let i = 0, len = keyList.length; i < len; i++) {
            let timer: Timer = this._TotalTimerMap.get(keyList[i]);
            if (!timer) {
                continue;
            }
            if (!timer.isComplete) {
                timer.update(dt);
            }
            else {
                this._CurrFrameCompleteTimers.push(timer.name);
            }
        }

        while (this._CurrFrameCompleteTimers.length > 0) {
            let removeTimerName = this._CurrFrameCompleteTimers.pop();
            // let oldCount = this._TotalTimerMap.size;
            let removeTimer = this._TotalTimerMap.get(removeTimerName);
            if (removeTimer) {
                this._TotalTimerMap.delete(removeTimerName);
                pool.push(removeTimer, "Timer");
            }
        }
    }

    /**
     * 
     * @param nameOrID 
     */
    public pauseListener(nameOrID: string | number): void {
        let targetTimer = this._findListener(nameOrID);
        if (targetTimer) {
            targetTimer.pause();
        }
    }

    /**
     * 
     * @param nameOrID 
     */
    public resumeListener(nameOrID: string | number): void {
        let targetTimer = this._findListener(nameOrID);
        if (targetTimer) {
            targetTimer.resume();
        }
    }

    /**
     * 
     * @param nameOrID 
     */
    protected _findListener(nameOrID: string | number): Timer {
        if (CommonUtils.IsString(nameOrID)) {
            return this._TotalTimerMap.get(nameOrID);
        }
        else {

            let currName = TimerManager.IdToName(<number>nameOrID);
            let result = this._TotalTimerMap.get(currName);
            if (!result) {
                let keyList = this._TotalTimerMap.keys;
                for (let i = 0, len = keyList.length; i < len; i++) {
                    let item = this._TotalTimerMap.get(keyList[i]);
                    if (item.seqID == nameOrID) {
                        result = item;
                        break;
                    }
                }
            }
            return result;
        }
    }

    /**
     * 
     * @param nameOrID 
     */
    public hasListener(nameOrID: string | number): boolean {
        return this._findListener(nameOrID) != null;
    }

    /**
     * 
     * @param interval 
     * @param repeat 
     * @param intervalListener 
     * @param completeListener 
     * @param listenerName 
     * @param delay 
     */
    public addTimerListener(interval: number, repeat: number, intervalListener: FunctionWrapper<TimerIntervalListener>, completeListener: FunctionWrapper<TimerComplpeteListener>, listenerName?: string, delay?: number): number {
        return this._pushTimerListener(interval, repeat, intervalListener, completeListener, listenerName, false, delay)
    }

    /**
     * 
     * @param interval 
     * @param repeat 
     * @param intervalListener 
     * @param completeListener 
     * @param listenerName 
     * @param delay 
     */
    public addFrameListener(interval: number, repeat: number, intervalListener: FunctionWrapper<TimerIntervalListener>, completeListener: FunctionWrapper<TimerComplpeteListener>, listenerName?: string, delay?: number): number {
        return this._pushTimerListener(interval, repeat, intervalListener, completeListener, listenerName, true, delay)
    }

    /**
     * 
     * @param listener 
     */
    public addNextFrameListener(listener: FunctionWrapper<TimerComplpeteListener>): number {
        let currID = CommonUtils.GetNextID();
        this.addFrameListener(1, 1, null, listener, TimerManager.IdToName(currID), 0);
        return currID;
    }

    /**
     * 
     * @param nameOrID 
     */
    public removeNextFrameListener(nameOrID: number): void {
        this.removeListener(nameOrID);
    }

    /**
     * 
     * @param listener 
     * @param timeout 
     */
    public setTimeout(listener: FunctionWrapper<TimerComplpeteListener>, timeout: number): number {
        let currID = CommonUtils.GetNextID();
        this.addTimerListener(timeout, 1, null, listener, TimerManager.IdToName(currID), 0);
        return currID;
    }

    /**
     * 
     * @param nameOrID 
     */
    public clearTimeout(nameOrID: number): void {
        this.removeListener(nameOrID);
    }

    /**
     * 
     * @param listener 
     * @param interval 
     */
    public setInterval(listener: FunctionWrapper<TimerIntervalListener>, interval: number): number {
        let currID = CommonUtils.GetNextID();
        this.addTimerListener(interval, 0, listener, null, TimerManager.IdToName(currID), 0);
        return currID;
    }

    /**
     * 
     * @param nameOrID 
     */
    public clearInterval(nameOrID: number): void {
        this.removeListener(nameOrID);
    }

    /**
     * 
     * @param nameOrID 
     */
    public removeListener(nameOrID: string | number): void {
        let timer = this._findListener(nameOrID);
        if (timer) {

            this._TotalTimerMap.delete(timer.name);
            pool.push(timer, "Timer");
        }
    }

    /**
     * 
     * @param interval 
     * @param repeat 
     * @param intervalListener 
     * @param completeListener 
     * @param listenerName 
     * @param isFrame 
     * @param delay 
     */
    public _pushTimerListener(interval: number, repeat: number, intervalListener: FunctionWrapper<TimerIntervalListener>, completeListener: FunctionWrapper<TimerComplpeteListener>, listenerName: string, isFrame: boolean, delay: number): number {
        let lastCount = this._TotalTimerMap.size;
        let seqID = CommonUtils.GetNextID();
        if (!listenerName || listenerName.length == 0) {
            listenerName = TimerManager.IdToName(seqID);
        }
        let addTimer: Timer = null;
        if (this._TotalTimerMap.has(listenerName)) {
            console.warn("[Timer] add same name time listener:" + listenerName);
            addTimer = this._TotalTimerMap.get(listenerName);
            addTimer.initTimer(seqID, interval, repeat, intervalListener, completeListener, listenerName, isFrame, delay);
            addTimer.reset();
        }
        else {
            addTimer = pool.pop("Timer");
            addTimer.initTimer(seqID, interval, repeat, intervalListener, completeListener, listenerName, isFrame, delay);
            this._TotalTimerMap.set(listenerName, addTimer);
        }

        return seqID;
    }

    /**
     * 
     * @param id 
     */
    private static IdToName(id: number): string {
        return "_default_" + id;
    }
}

export var timer = TimerManager.instance();
