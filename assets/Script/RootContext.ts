import Notify from "./Common/Notify/Notify";
import MVCContext from "./Frame/MVC/MVCContext";

export var ROOT_CONTXET_NAME: string = "ROOT_CONTEXT";

export default class RootContext extends MVCContext {
    private _HandlerMap: { [key: string]: { handler: (Notify) => void, thisObj: any }[] };
    constructor() {
        super(ROOT_CONTXET_NAME);
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
        let count = super.executeNotify(notify);
        do {
            if (notify.stopPropagetion) {
                break;
            }

            if (notify.notifyType in this._HandlerMap) {
                let handlerList = this._HandlerMap[notify.notifyType];
                if (handlerList) {
                    handlerList = handlerList.slice();
                    for (let i = 0, len = handlerList.length; i < len; i++) {
                        count++;
                        let item = handlerList[i];
                        item.handler.call(item.thisObj, notify);
                        if (notify.stopPropagetion)
                            break;
                    }
                }
            }
            notify.handled();

        } while (false)

        return count;
    }
}