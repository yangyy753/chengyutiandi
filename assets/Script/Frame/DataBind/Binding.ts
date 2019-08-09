import TMap from "../../Struct/TMap";
import BindLink from "./BindLink";
import CommonUtils from "../../Common/utils/CommonUtils";
import { functionWrapper } from "../../Struct/FunctionWrapper";
import { timer } from "../../Common/Time/TimerManager";
import { gameGlobal } from "../../GameGlobal";

const _PropertyBindItemsName: string = "__MVCPropertyBindItems__";
const _HandlerBindItemsName: string = "__MVCFunctionBindItems__";
const _LinksTargetObjectID: string = "___LinksTargetObjectID__";
const _OpenBindTimeID: string = "___OpenBindTimeID__"
var _totalBindLink: TMap<number, BindLink[]> = new TMap<number, BindLink[]>();

/**
 * 在节点被打开时，建立所有绑定
 * @param target 节点实例
 */
function checkPropertyBindWhenOpen(target: any, targetProperty?: any): void {
    if (target[_OpenBindTimeID]) {
        delete target[_OpenBindTimeID];
    }

    if (!targetProperty)
        targetProperty = Object.getPrototypeOf(target);
    if (!targetProperty || !targetProperty.constructor)
        return;
    let propBinditems: { sourceChain: string, targetChain: string }[] = targetProperty.constructor[_PropertyBindItemsName];
    if (propBinditems && propBinditems.length > 0) {
        if (!target[_LinksTargetObjectID]) {
            target[_LinksTargetObjectID] = CommonUtils.GetNextID();
        }
        let linkList = _totalBindLink.get(target[_LinksTargetObjectID]);
        if (!linkList) {
            linkList = [];
            _totalBindLink.set(target[_LinksTargetObjectID], linkList);
        }

        for (let i = 0, len = propBinditems.length; i < len; i++) {
            let chainItem = propBinditems[i];
            let keyArr = chainItem.sourceChain.split(":");
            let modelName = keyArr.shift();
            let finalSourceChain = keyArr.join(".");
            let currModel: any = gameGlobal.$CurrOpenContext.findModelWithModelName(modelName);
            let bindLink = BindLink.CreateLink(currModel, finalSourceChain, target, chainItem.targetChain);
            linkList.push(bindLink);
        }
    }
    if (targetProperty["__proto__"]) {
        checkPropertyBindWhenOpen(target, targetProperty["__proto__"]);
    }
}
/**
 * 在节点被打开时，建立所有绑定
 * @param target 节点实例
 */
function checkFunctionBindWhenOpen(target: any, targetProperty?: any): void {
    if (!targetProperty)
        targetProperty = Object.getPrototypeOf(target);
    if (!targetProperty || !targetProperty.constructor)
        return;
    let handlerBinditems: { sourceChain: string, targetChain: string }[] = targetProperty.constructor[_HandlerBindItemsName];
    if (handlerBinditems && handlerBinditems.length > 0) {
        for (let i = 0, len = handlerBinditems.length; i < len; i++) {
            let chainItem = handlerBinditems[i];
            let keyArr = chainItem.sourceChain.split(":");
            let modelName = keyArr[0];
            let finalSourceChain = keyArr[1];

            let currModel: any = gameGlobal.$CurrOpenContext.findModelWithModelName(modelName);
            if (currModel && currModel[finalSourceChain])
                target[chainItem.targetChain] = currModel[finalSourceChain].bind(currModel);
        }
    }
    if (targetProperty["__proto__"]) {
        checkFunctionBindWhenOpen(target, targetProperty["__proto__"]);
    }
}



/**
 * 在节点被关闭时，断开所有绑定连接
 * @param target 节点实例
 */
function unlinkBindWhenClose(target: any): void {
    if (target[_LinksTargetObjectID]) {
        let bindLinkList: BindLink[] = _totalBindLink.get(target[_LinksTargetObjectID]);
        _totalBindLink.remove(target[_LinksTargetObjectID]);
        delete target[_LinksTargetObjectID];
        for (let i = 0, len = bindLinkList.length; i < len; i++) {
            bindLinkList[i].unlink();
        }
    }
    let targetProperty = Object.getPrototypeOf(target);
    let handlerBinditems: { sourceChain: string, targetChain: string }[] = targetProperty.constructor[_HandlerBindItemsName];
    if (handlerBinditems && handlerBinditems.length > 0) {
        for (let i = 0, len = handlerBinditems.length; i < len; i++) {
            let chainItem = handlerBinditems[i];
            target[chainItem.targetChain] = null;
        }
    }
}
/**
 * 重写mvc节点的onContextOpen,onContextClose,以支持自动绑定接口和属性
 * @param constructor 节点构造
 */
function rewriteWatcherOpenClose(constructor: any, openFuncName: string, closeFuncName: string) {
    if (!constructor[_PropertyBindItemsName] && !constructor[_HandlerBindItemsName]) {
        constructor[_PropertyBindItemsName] = [];
        constructor[_HandlerBindItemsName] = [];
        let oldContextOpenFunc = constructor.prototype[openFuncName];
        constructor.prototype[openFuncName] = function () {
            checkFunctionBindWhenOpen(this);
            oldContextOpenFunc && oldContextOpenFunc.apply(this, arguments);
            this[_OpenBindTimeID] = timer.addNextFrameListener(functionWrapper(checkPropertyBindWhenOpen, null, this));
            //checkBindWhenOpen(this);
        }
        let oldContextCloseFunc = constructor.prototype[closeFuncName];
        constructor.prototype[closeFuncName] = function () {
            oldContextCloseFunc && oldContextCloseFunc.apply(this, arguments);
            if (this[_OpenBindTimeID] > 0) {//还没到下一帧，该组件就已经被移除了
                timer.removeListener(this[_OpenBindTimeID]);
                delete this[_OpenBindTimeID];
            }
            unlinkBindWhenClose(this);
        }
    }

}
/**
 * mvc节点的属性绑定装饰器,在mvc节点被打开时会自动建立绑定，在节点被关闭的时候解除绑定
 * @param sourceChain   访问源，例：TestModel:a.b.c 
 * @param watcherChain  宿主源,例：a.b.c
 */
export function mvc_property_bind(sourceChain: string, watcherChain?: string) {
    return function (target: any, propertyName: string) {

        let constructor = target["constructor"];
        rewriteWatcherOpenClose(constructor, "onContextOpen", "onContextClose");
        constructor[_PropertyBindItemsName].push({ sourceChain: sourceChain, targetChain: (watcherChain && watcherChain.length > 0) ? propertyName + "." + watcherChain : propertyName });
    }
}

/**
 * Component节点的set访问器绑定装饰器,在Component节点被打开时会自动建立绑定，在节点被关闭的时候解除绑定
 * @param sourceChain   访问源，例：TestModel:a.b.c
 * @param watcherChain  宿主源,例：a.b.c
 */
export function mvc_set_bind(sourceChain: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {

        let constructor = target["constructor"];
        rewriteWatcherOpenClose(constructor, "onContextOpen", "onContextClose");
        constructor[_PropertyBindItemsName].push({ sourceChain: sourceChain, targetChain: propertyName });
    }
}
/**
 * mvc节点的方法绑定装饰器
 * 在mvc节点被打开时会自动建立绑定，在节点被关闭的时候解除绑定
 * @param sourceChain   访问源，例：TestModel:a.b.c 
 */
export function mvc_function_bind(sourceChain: string) {
    return function (target: any, propertyName: string) {
        let constructor = target["constructor"];
        rewriteWatcherOpenClose(constructor, "onContextOpen", "onContextClose");
        constructor[_HandlerBindItemsName].push({ sourceChain: sourceChain, targetChain: propertyName });
    }
}

/**
 * Component节点的属性绑定装饰器,在Component节点被打开时会自动建立绑定，在节点被关闭的时候解除绑定
 * @param sourceChain   访问源，例：TestModel:a.b.c
 * @param watcherChain  宿主源,例：a.b.c
 */
export function cc_property_bind(sourceChain: string, watcherChain: string = null, openFuncName: string = "onEnable", closeFuncName: string = "onDisable") {
    return function (target: any, propertyName: string) {

        let constructor = target["constructor"];
        rewriteWatcherOpenClose(constructor, openFuncName, closeFuncName);
        constructor[_PropertyBindItemsName].push({ sourceChain: sourceChain, targetChain: (watcherChain && watcherChain.length > 0) ? propertyName + "." + watcherChain : propertyName });
    }
}
/**
 * Component节点的set访问器绑定装饰器,在Component节点被打开时会自动建立绑定，在节点被关闭的时候解除绑定
 * @param sourceChain   访问源，例：TestModel:a.b.c
 * @param watcherChain  宿主源,例：a.b.c
 */
export function cc_set_bind(sourceChain: string, openFuncName: string = "onEnable", closeFuncName: string = "onDisable") {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {

        let constructor = target["constructor"];
        rewriteWatcherOpenClose(constructor, openFuncName, closeFuncName);
        constructor[_PropertyBindItemsName].push({ sourceChain: sourceChain, targetChain: propertyName });
    }
}

var Count: number = 1;
/**
 * Component节点的方法绑定装饰器
 * 在Component节点被激活时会自动建立绑定，在节点被关闭的时候解除绑定
 * @param sourceChain   访问源，例：TestModel:a.b.c
 */
export function cc_function_bind(sourceChain: string, openFuncName: string = "onEnable", closeFuncName: string = "onDisable") {
    return function (target: any, propertyName: string) {
        let constructor = target["constructor"];
        //console.log( constructor.name );
        rewriteWatcherOpenClose(constructor, openFuncName, closeFuncName);
        constructor[_HandlerBindItemsName].push({ sourceChain: sourceChain, targetChain: propertyName });
    }
}