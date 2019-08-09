import FunctionWrapper from "../../Struct/FunctionWrapper";
import { TimerIntervalListener, TimerComplpeteListener } from "./TimerManager";
import { IPoolItem } from "../Pool/IPoolItem";

export class Timer implements IPoolItem {

    protected _Interval: number;
    protected _Repeat: number;
    /**
     * @member {Function}
     */
    _IntervalListener: FunctionWrapper<TimerIntervalListener>;
    /**
     * @member {Function}
     */
    _CompleteListener: FunctionWrapper<TimerComplpeteListener>;
    /**
     * 
     */
    _ListenerName: string;
    /**
     * 
     */
    _TotalDT: number;
    /**
     * 
     */
    _TriggerCount: number;
    /**
     * 
     */
    _IsComplete: boolean;
    /**
     * 
     */
    _IsFrame: boolean;
    /**
     * 
     */
    _CurrDelay: number;
    /**
     * 
     */
    _IsPause: boolean;
    /**
     * @member {number} 溢出计时
     */
    _OverflowDT: 0;
    _seqID: number;
    constructor() {
    }

    /**
     * 
     * @param id 
     * @param interval 
     * @param repeat 
     * @param intervalListener 
     * @param completeListener 
     * @param listenerName 
     * @param isFrame 
     * @param delay 
     */
    public initTimer(id: number, interval: number, repeat: number, intervalListener: FunctionWrapper<TimerIntervalListener>, completeListener: FunctionWrapper<TimerComplpeteListener>, listenerName: string, isFrame: boolean = false, delay: number = 0) {
        this._Interval = interval <= 0 ? 1 : interval;
        this._Repeat = repeat;
        this._IntervalListener = intervalListener;
        this._CompleteListener = completeListener;
        this._CurrDelay = delay;
        this._ListenerName = listenerName;
        this._IsFrame = isFrame;
        this._TotalDT = 0;
        this._TriggerCount = 0;
        this._IsComplete = false;
        this._IsPause = false;
        this._OverflowDT = 0;
        this._seqID = id;
    }

    /**
     * 
     */
    get seqID() {
        return this._seqID;
    }

    /**
     * 
     */
    public reset() {
        this._TotalDT = 0;
        this._TriggerCount = 0;
        this._IsComplete = false;
        this._IsPause = false;
        this._OverflowDT = 0;
    }

    /**
     * 
     */
    public reuse(): void {
        this.clear();
    }

    /**
     * 
     */
    public unuse(): void {
        this.clear();
    }

    /**
     * 
     */
    public destory(): void {
        this.clear();
    }

    /**
     * 
     */
    public clear(): void {
        this.reset();
        this._IntervalListener = null;
        this._CompleteListener = null;
        this._CurrDelay = 0;
        this._IsPause = false;
        this._OverflowDT = 0;
    }

    /**
     * 
     */
    public pause(): void {
        this._IsPause = true;
    }

    /**
     * 
     */
    public resume(): void {
        this._IsPause = false;
    }

    /**
     * 
     */
    get name() {
        return this._ListenerName;
    }

    /**
     * 
     */
    get isComplete() {
        return this._IsComplete;
    }

    /**
     * 
     * @param dt 
     */
    public update(dt: number): void {
        if (this._IsComplete)
            return;
        if (this._IsPause)
            return;
        if (this._CurrDelay > 0) {
            if (this._IsFrame) {
                this._CurrDelay--;
            }
            else {
                this._CurrDelay -= dt * 1000;
            }
            return;
        }
        if (this._IsFrame) {
            this._OverflowDT++;
        }
        else {
            this._OverflowDT += dt * 1000;
        }
        let currCount = 0;
        while (this._OverflowDT >= this._Interval) {
            this._OverflowDT -= this._Interval;
            this._TotalDT += this._Interval;
            currCount++;
        }

        if (currCount > 0) {
            let newCount = currCount + this._TriggerCount;
            this._TriggerCount = this._Repeat > 0 ? Math.min(newCount, this._Repeat) : newCount;

            if (this._IntervalListener) {
                if (this._IntervalListener) {
                    this._IntervalListener.execute(this._TriggerCount, this._TotalDT);
                }
            }

            if (this._Repeat > 0 && this._TriggerCount >= this._Repeat) {
                this._IsComplete = true;
                this._TriggerCount = this._Repeat;
                if (this._CompleteListener) {
                    this._CompleteListener.execute();
                }
            }
        }
    }
}