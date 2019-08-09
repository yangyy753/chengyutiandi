import Notify from "./Notify";
import { timer } from "../Time/TimerManager";
import { functionWrapper } from "../../Struct/FunctionWrapper";
import { pool } from "../Pool/PoolManager";
import { Debug } from "../Log/LogManager";

/**
 * 通知路由接口
 */
export interface INotifyRouting {
    addNotifyListener?(notifyType: string, handler: (Notify) => void, handlerThis: any): void;
    removeNotifyListener?(notifyType: string, handler?: (Notify) => void, handlerThis?: any): void;
    /**
     * 执行一条通知
     * @param notify
     * @returns 该通知被处理的次数 
     */
    executeNotify(notify: Notify): number;
}
/**
 * 标准通知路由
 */
export class StandardRouting implements INotifyRouting {
    private _HandlerMap: { [key: string]: { handler: (Notify) => void, thisObj: any }[] };
    constructor() {
        this._HandlerMap = {};
    }
    public addNotifyListener(notifyType: string, handler: (Notify) => void, handlerThis: any): void {
        if (notifyType in this._HandlerMap) {
            let handlerList = this._HandlerMap[notifyType];
            for (let i = 0, len = handlerList.length; i < len; i++) {
                let item = handlerList[i];
                if (item.handler == handler && item.thisObj == handlerThis) {
                    return;
                }
            }
            handlerList.push({ handler: handler, thisObj: handlerThis });
        }
        else {
            this._HandlerMap[notifyType] = [{ handler: handler, thisObj: handlerThis }];
        }
    }
    public removeNotifyListener(notifyType: string, handler?: (Notify) => void, handlerThis?: any): void {
        if (notifyType in this._HandlerMap) {
            let handlerList = this._HandlerMap[notifyType];
            if (!handlerThis) {
                handlerList.length = 0;
            }
            else {
                for (let i = 0, len = handlerList.length; i < len; i++) {
                    let item = handlerList[i];

                    if (item.thisObj == handlerThis && (!handler || item.handler == handler)) {
                        handlerList.splice(i, 1);
                        break;
                    }
                }
            }
            if (handlerList.length == 0) {
                delete this._HandlerMap[notifyType];
            }
        }
    }
    public executeNotify(notify: Notify): number {
        Debug.Log_G("Test", "NotifyCenter.executeNotify:", notify.notifyType, ",begin");
        let obsCount = 0;
        if (notify.notifyType in this._HandlerMap) {
            let handlerList = this._HandlerMap[notify.notifyType].slice();
            for (let i = 0, len = handlerList.length; i < len; i++) {
                obsCount++;
                let item = handlerList[i];
                item.handler.apply(item.thisObj, notify);
                if (notify.stopPropagetion)
                    break;
            }
        }
        notify.handled();
        Debug.Log_G("Test", "NotifyCenter.executeNotify:", notify.notifyType, ",end");
        return obsCount;
    }
}


/**
 * MVC 通知派发中心
 */
export default class NotifyCenter<TRouting extends INotifyRouting>
{
    private _NotifyQueue: Array<Notify>;
    private _NextFrameTimerID: number;
    private _TotalNotifyQueueMap: { [key: string]: Notify[] };


    // private _NotifyPool:Pool<Notify>;
    protected _RoutingProto: TRouting;


    protected _sleepItems: { key: string, timeout: number, timerID: number }[]

    constructor(routing: TRouting) {
        this._NotifyQueue = new Array<Notify>();
        this._NextFrameTimerID = -1;
        this._TotalNotifyQueueMap = null;

        this._RoutingProto = routing;

        this._sleepItems = [];
        pool.registerPool("Notify", Notify);
    }

    get isSleeping() {
        return this._sleepItems.length > 0;
    }
    /**
     * 暂停通知派发
     * @param time 自动恢复时间（毫秒）
     */
    public pause(key: string, time: number) {
        let targetItem: { key: string, timeout: number, timerID: number } = null;
        for (let i = 0, len = this._sleepItems.length; i < len; i++) {
            let item = this._sleepItems[i];
            if (item.key == key) {
                targetItem = item;
                break;

            }
        }
        if (targetItem == null) {
            targetItem = { key: key, timeout: time, timerID: -1 };
            this._sleepItems.push(targetItem);
        }
        else {
            if (targetItem.timerID != -1) {
                timer.clearTimeout(targetItem.timerID);
            }
            targetItem.timerID = -1;
            targetItem.timeout = time;
        }

        if (targetItem.timeout > 0) {
            targetItem.timerID = timer.setTimeout(functionWrapper(this.onSleepItemTimeout, this, targetItem), time);
        }
    }

    protected onSleepItemTimeout(targetItem: { key: string, timeout: number, timerID: number }) {
        targetItem.timerID = -1;
        this.resume(targetItem.key);
    }

    public resume(key: string) {
        let targetIndex = -1;

        for (let i = 0, len = this._sleepItems.length; i < len; i++) {
            let item = this._sleepItems[i];
            if (item.key == key) {
                targetIndex = i;
                break;
            }
        }
        if (targetIndex >= 0) {
            this._sleepItems.splice(targetIndex, 1);
            if (!this.isSleeping && this._NextFrameTimerID == -1) {
                this._NextFrameTimerID = timer.addNextFrameListener(functionWrapper(this._handlerNextFrame, this));
            }
        }
    }
    public resumeAll() {
        let list = this._sleepItems.slice();
        this._sleepItems.length = 0;
        for (let i = 0, len = list.length; i < len; i++) {
            let targetItem: { key: string, timeout: number, timerID: number } = list[i];
            if (targetItem.timeout > 0) {
                timer.clearTimeout(targetItem.timeout);
                targetItem.timeout = -1;
            }
        }
        if (this._NextFrameTimerID == -1) {
            this._NextFrameTimerID = timer.addNextFrameListener(functionWrapper(this._handlerNextFrame, this));
        }
    }

    get routing() {
        return this._RoutingProto;
    }
    /**
     * 注册一个通知监听
     * @param notifyType 通知类型
     * @param handler 处理回调
     */
    public addNotifyListener(notifyType: string, handler: (Notify) => void, handlerThis: any): void {
        if (this._RoutingProto.addNotifyListener) {
            this._RoutingProto.addNotifyListener(notifyType, handler, handlerThis);
        }
    }

    /**
     * 删除某个通知监听，如果handler为空，则会删除handerThis的所有notifyType监听，如果handlerThis也为空，则会删除所有notifyType监听
     * @param notifyType 通知类型
     * @param handler 处理回调
     * @param handlerThis 回调this
     */
    public removeNotifyListener(notifyType: string, handler?: (Notify) => void, handlerThis?: any): void {
        if (this._RoutingProto.removeNotifyListener) {
            this._RoutingProto.removeNotifyListener(notifyType, handler, handlerThis);
        }

    }
    /**
     * 注册一个消息队列
     * @param queueName 通知队列名字
     */
    public registerNotifyQueue(queueName: string): void {
        if (this._TotalNotifyQueueMap == null) {
            this._TotalNotifyQueueMap = {};
            this._TotalNotifyQueueMap[queueName] = [];
            return;
        }
        if (queueName in this._TotalNotifyQueueMap) {
            return;
        }
        this._TotalNotifyQueueMap[queueName] = [];
    }

    /**
     * 抛出一条匿名通知
     * @param ntfType 通知类型
     * @param userData 携带参数
     * @param isNextFramePost 是否下一帧触发
     * @param queueName 队列名字
     */
    public postNotify(ntfType: string, userData?: any, isNextFramePost: boolean = true, queueName?: string): void {
        let notify = pool.pop("Notify");
        notify = Notify.Reset(notify, ntfType, userData, isNextFramePost);
        this._postNotify(notify, queueName);
    }
    /**
     * 抛出一条通知
     * @param notify 通知
     * @param queueName 队列名字
     */
    public _postNotify(notify: Notify, queueName?: string): void {
        if (queueName && queueName.length > 0) {
            this._postNotifyToQueue(notify, queueName);
            return;
        }
        if (notify.isNextFramePost || this.isSleeping) {
            this._addNotifyToPool(notify);
        }
        else {
            this._executeNotify(notify);
        }

    }
    /**
     * 抛出一条通知到某条队列中
     * @param notify 通知
     * @param queueName 队列名字
     */
    public _postNotifyToQueue(notify: Notify, queueName: string): void {
        if (!this._TotalNotifyQueueMap || !(queueName in this._TotalNotifyQueueMap)) {
            this._postNotify(notify);
            return;
        }
        this._TotalNotifyQueueMap[queueName].push(notify);
        notify.queueName = queueName;
        if (this._TotalNotifyQueueMap[queueName].length == 1) {
            if (!notify.isNextFramePost && !this.isSleeping) {//不是下一帧执行，并且通知派发器没有休眠
                let count = this._executeNotify(notify);
                if (count == 0 || notify.isComplete) {
                    pool.push(this._TotalNotifyQueueMap[queueName].shift(), "Notify");
                }
            }
        }
        if (this._NextFrameTimerID == -1) {
            this._NextFrameTimerID = timer.addNextFrameListener(functionWrapper(this._handlerNextFrame, this));
        }
    }
    /**
     * 获取某队列中正在执行的通知
     * @param queueName 队列名字
     */
    public getCurrNotifyFromQueue(queueName: string): Notify | null {
        if (!this._TotalNotifyQueueMap)
            return null;
        if (queueName in this._TotalNotifyQueueMap) {
            let notifyList = this._TotalNotifyQueueMap[queueName];
            if (notifyList.length > 0)
                return notifyList[0];
        }
        return null;
    }
    /**
     * 结束某队列当前通知，开始执行下一条通知
     * @param queueName 队列名字
     */
    public nextNotifyQueue(queueName: string): void {
        if (!this._TotalNotifyQueueMap)
            return;
        if (queueName in this._TotalNotifyQueueMap) {
            let notifyList = this._TotalNotifyQueueMap[queueName];
            if (notifyList.length > 0) {
                let ntf = notifyList.shift();
                pool.push(ntf, "Notify");
            }
            while (notifyList.length > 0) {
                if (notifyList[0].isNextFramePost)
                    break;
                let count = this._executeNotify(notifyList[0]);
                if (count == 0 || notifyList[0].isComplete) {
                    pool.push(notifyList.shift(), "Notify");
                }
                else {
                    break;
                }
            }
        }
    }
    /**
     * 清除某条队列中的全部通知
     * @param queueName 队列名字
     */
    public clearNotifyQueue(queueName: string): void {
        if (!this._TotalNotifyQueueMap)
            return;
        if (queueName in this._TotalNotifyQueueMap) {
            pool.push(this._TotalNotifyQueueMap[queueName], "Notify");
            this._TotalNotifyQueueMap[queueName].length = 0;
        }
    }
    /**
     * 清空全部队列通知
     */
    public clearAllNotifyQueue(): void {
        if (!this._TotalNotifyQueueMap)
            return;
        for (let key in this._TotalNotifyQueueMap) {
            pool.push(this._TotalNotifyQueueMap[key], "Notify");
            this._TotalNotifyQueueMap[key].length = 0;
        }
    }
    protected _addNotifyToPool(notify: Notify): void {
        this._NotifyQueue.push(notify);
        if (this._NextFrameTimerID === undefined || this._NextFrameTimerID == -1) {
            this._NextFrameTimerID = timer.addNextFrameListener(functionWrapper(this._handlerNextFrame, this));
        }
    }
    protected _handlerNextFrame(): void {
        this._NextFrameTimerID = -1;
        if (this.isSleeping) {
            this._NextFrameTimerID = timer.addNextFrameListener(functionWrapper(this._handlerNextFrame, this));
            return;
        }

        if (this._NotifyQueue.length > 0) {
            let notifyList = this._NotifyQueue.slice();
            this._NotifyQueue = [];
            let len = notifyList.length;
            for (var i = 0; i < len; i++) {
                this._executeNotify(notifyList[i]);
            }
            pool.push(notifyList, "Notify");
        }

        let totalCount = 0;
        for (let key in this._TotalNotifyQueueMap) {
            let notifyList2 = this._TotalNotifyQueueMap[key];
            if (notifyList2.length == 0)
                continue;
            while (notifyList2.length > 0) {
                let notify = notifyList2[0];
                let count = 1;
                if (!notify.isHandled) {
                    count = this._executeNotify(notify);
                }
  
                if (count == 0 || notify.isComplete) {
                    pool.push(notifyList2.shift(), "Notify");
                    continue;
                }
                else {
                    break;
                }
            }
            totalCount += notifyList2.length;
        }
        totalCount += this._NotifyQueue.length;
        if (totalCount > 0) {
            this._NextFrameTimerID = timer.addNextFrameListener(functionWrapper(this._handlerNextFrame, this));
        }
    }
    protected _executeNotify(notify: Notify): number {
        return this._RoutingProto.executeNotify(notify);
    }
}
