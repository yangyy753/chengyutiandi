import TMap from "../Struct/TMap";
import Dictionary from "../Struct/Dictionary";
import { timer } from "../Common/Time/TimerManager";
import { functionWrapper } from "../Struct/FunctionWrapper";
import CommonUtils from "../Common/utils/CommonUtils";
import { pool } from "../Common/Pool/PoolManager";
import BindLink from "./DataBind/BindLink";
import Notify from "../Common/Notify/Notify";
import { gameGlobal } from "../GameGlobal";

const { ccclass, property } = cc._decorator;
@ccclass
export default class BaseComponent extends cc.Component {
    private _notifyHandlerList: TMap<string, (notify: Notify) => void>;

    protected mBindLinkList: BindLink[];
    protected _enableTimerID: number;

    private _isEnable: boolean;
    private _isTotalEnable: boolean;

    private _timeoutMap: Dictionary;
    private _intervalMap: Dictionary;
    protected _enableTimes: number;
    protected _totalEnableTimes: number;

    constructor() {
        super();
        this._enableTimerID = -1;
        this._isEnable = false;
        this._isTotalEnable = false;
        this._totalEnableTimes = this._enableTimes = 0;
    }

    onLoad() {
    }

    onEnable() {
        this._enableTimerID = timer.addNextFrameListener(functionWrapper(this.onTotalEnable, this));
        this._isEnable = true;
        this._enableTimes++;
    }

    onTotalEnable() {
        if (this.isEnabled) {
            this._totalEnableTimes++;
            this._enableTimerID = -1;
            this._isTotalEnable = true;
        }
    }

    get isEnabled() {
        return this._isEnable;
    }

    get isTotalEnabled() {
        return this._isTotalEnable;
    }

    setTimeout(handler: Function, timeout: number, ...arams: any[]) {
        let self = this;
        let id = CommonUtils.GetNextID();
        let func = function () {
            self._timeoutMap.delete(id);
            if (arams && arams.length > 0)
                handler.apply(null, arams);
            else
                handler();

        };

        this.scheduleOnce(func, timeout / 1000);
        if (!this._timeoutMap) {
            this._timeoutMap = new Dictionary();
        }

        this._timeoutMap.set(id, func);

        return id;
    }

    clearTimeout(id: number) {
        if (this._timeoutMap) {
            let handle = this._timeoutMap.get(id);
            if (handle) {
                this._timeoutMap.delete(id);
                this.unschedule(handle);
            }
        }
    }

    clearAllTimeout() {
        if (this._timeoutMap) {
            let keys = this._timeoutMap.keys;
            for (let i = 0, len = keys.length; i < len; i++) {
                let handle = this._timeoutMap.get(keys[i]);
                this._timeoutMap.delete(keys[i]);
                if (handle) {
                    this.unschedule(handle);
                }
            }
        }
    }

    setInterval(handler: Function, timeout: number, ...arams: any[]) {
        let func = function () {
            if (arams && arams.length > 0)
                handler.apply(null, arams);
            else
                handler();
        };
        this.schedule(func, timeout / 1000, cc.macro.REPEAT_FOREVER);
        if (!this._intervalMap) {
            this._intervalMap = new Dictionary();
        }
        let id = CommonUtils.GetNextID();
        this._intervalMap.set(id, func);
        return id;
    }

    clearInterval(id: number) {
        if (this._intervalMap) {
            let handle = this._intervalMap.get(id);
            if (handle) {
                this._intervalMap.delete(id);
                this.unschedule(handle);
            }

        }
    }

    clearAllInterval() {
        if (this._intervalMap) {
            let keys = this._intervalMap.keys;
            for (let i = 0, len = keys.length; i < len; i++) {
                let handle = this._intervalMap.get(keys[i]);
                this._intervalMap.delete(keys[i]);
                if (handle) {
                    this.unschedule(handle);
                }
            }
        }
    }

    public addBinding(source: any, sourceChain: string, target: any, targetChain: string): void {
        let link = this.findBindLink(sourceChain, target, targetChain, source);
        if (link) {
            if (link.source === source)
                return;
            link.unlink();
            let index = this.mBindLinkList.indexOf(link);
            this.mBindLinkList.splice(index, 1);
        }
        link = BindLink.CreateLink(source, sourceChain, target, targetChain);
        if (!this.mBindLinkList) {
            this.mBindLinkList = [link];
        }
        else {
            this.mBindLinkList.push(link);
        }
    }

    public removeBinding(source: any, sourceChain: string, target: any, targetChain: string): void {
        let link = this.findBindLink(source, sourceChain, target, targetChain);
        if (link) {
            link.unlink();
            let index = this.mBindLinkList.indexOf(link);
            this.mBindLinkList.splice(index, 1);
        }
    }

    public unAllBinkLink() {
        if (this.mBindLinkList) {
            while (this.mBindLinkList.length > 0) {
                let link = this.mBindLinkList.pop();
                link.unlink();
            }
        }
    }

    protected findBindLink(sourceChain: string, target: any, targetChain: string, source?: any): BindLink {
        if (!this.mBindLinkList)
            return null;
        let result: BindLink = null;
        for (let i = 0, len = this.mBindLinkList.length; i < len; i++) {
            let link = this.mBindLinkList[i];
            if ((!source || link.source === source) && link.target === target &&
                link.sourceChain == sourceChain && link.targetChain == targetChain) {
                result = link;
                break;
            }
        }
        return result;
    }

    protected onDisable() {
        this._isEnable = this._isTotalEnable = false;
        if (this._enableTimerID != -1) {
            timer.removeNextFrameListener(this._enableTimerID);
            this._enableTimerID = -1;
        }
        this.clearAllTimeout();
        this.clearAllInterval();

    }

    public dispatchEvent(evtType: string, userData?: any) {
        let evt: cc.Event.EventCustom = pool.pop("cc.Event.EventCustom");
        evt.type = evtType;
        evt.bubbles = true;
        evt.setUserData(userData);
        this.node.dispatchEvent(evt);
        pool.push(evt, "cc.Event.EventCustom");
    }

    public emit(message: string, detail?: any): void {
        this.node.emit(message, detail);
    }

    public on(type: string, callback: (event: cc.Event) => void, target?: any, useCapture?: boolean): void {
        this.node.on.apply(this.node, arguments);
    }
    public off(type: string, callback?: Function, target?: any, useCapture?: boolean): void {
        this.node.off.apply(this.node, arguments);
    }

    public postNotify(ntfType: string, userData?: any, isNextFramePost?: boolean, queueName?: string): void {
        gameGlobal.postNotify(ntfType, userData, isNextFramePost, queueName);
    }
    public addNotify(ntfType: string, listener: (notify: Notify) => void): void {
        gameGlobal.addNotifyListener(ntfType, listener, this);
        if (!this._notifyHandlerList) {
            this._notifyHandlerList = new TMap<string, (notify: Notify) => void>();
        }
        this._notifyHandlerList.set(ntfType, listener);
    }

    public removeNotify(ntfType: string): void {
        let handler = this._notifyHandlerList && this._notifyHandlerList.get(ntfType);
        if (handler) {
            gameGlobal.removeNotifyListener(ntfType, handler, this);
        }
    }

    public removeAllNotify(): void {
        if (this._notifyHandlerList && this._notifyHandlerList.size > 0) {
            let self = this;
            this._notifyHandlerList.each(function (key: string, handler: (notify: Notify) => void): boolean {
                gameGlobal.removeNotifyListener(key, handler, self);
                return false;
            })
            this._notifyHandlerList.clear();
        }
    }
    
    public onDestroy(): void {
        this._isEnable = this._isTotalEnable = false;
        this.unAllBinkLink();
        this.removeAllNotify();
        this._notifyHandlerList = null;
    }
}