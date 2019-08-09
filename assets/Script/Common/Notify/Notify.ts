import { IPoolItem } from "../pool/Pool";
import { timer } from "../Time/TimerManager";
import { functionWrapper } from "../../Struct/FunctionWrapper";

export default class Notify implements IPoolItem {
    private _Type: string;
    private _Dispatcher: any;
    protected _ResultCode: number;
    protected _UserData: any;
    protected _IsStopPropagetion: boolean;
    protected _IsNextFramePost: boolean;
    protected _IsComplete: boolean;
    protected _ParentQueueName: string;
    protected _IsHandled: boolean;
    
    constructor() {
        this._IsComplete = false;
        this._ParentQueueName = null;
        this._IsHandled = false;
    }

    get notifyType(): string {
        return this._Type;
    }

    get resultCode(): number {
        return this._ResultCode;
    }

    get userData(): any {
        return this._UserData
    }

    get isHandled() {
        return this._IsHandled;
    }

    public handled(): void {
        this._IsHandled = true;
    }

    public getUserDataForKey(key: string): any {
        if (this._UserData)
            return this._UserData[key];
        return null;
    }

    public setUserDataForKey(key: string, value: any) {
        if (!this._UserData)
            this._UserData = {};
        this._UserData[key] = value;
    }

    public hasUserDataKey(key: string): boolean {
        return this._UserData && key in this._UserData;
    }

    public delteUserDataForKey(key: string): void {
        if (this._UserData && key in this._UserData) {
            delete this._UserData[key];
        }
    }

    set stopPropagetion(value: boolean) {
        this._IsStopPropagetion = value;
    }

    get stopPropagetion() {
        return this._IsStopPropagetion;
    }

    get isNextFramePost() {
        return this._IsNextFramePost;
    }

    get dispatcher() {
        return this._Dispatcher;
    }

    setComplete(delay: number = 0) {
        if (delay > 0) {
            this._IsComplete = false;

            timer.setTimeout(functionWrapper(this._setComplete, this), delay);
        }
        else {
            this._IsComplete = true;
        }
    }

    private _setComplete() {
        this._IsComplete = true;
    }

    get isComplete() {
        return this._IsComplete;
    }

    get isInQueue() {
        return this._ParentQueueName && this._ParentQueueName.length;
    }

    get queueName() {
        return this._ParentQueueName;
    }

    set queueName(name) {
        this._ParentQueueName = name;
    }

    public reuse(): void {
        this._reset();
    }

    public unuse(): void {
        this._reset();
    }

    public destory(): void {
        this._reset();
    }

    protected _reset(): void {
        this._ParentQueueName = null;
        this._IsComplete = false;
        this._Dispatcher = null;
        this._IsNextFramePost = true;
        this._IsComplete = false;
        this._IsHandled = false;
        this._UserData = null;
        this._IsStopPropagetion = false;
        this._ResultCode = 0;
    }

    public static Reset(notify: Notify, ntfType: string, userData: any | null = null, nextFramePost: boolean = true): Notify {
        notify._reset();
        notify._Type = ntfType;
        notify._UserData = userData;
        notify._IsNextFramePost = nextFramePost;
        return notify;
    }

}