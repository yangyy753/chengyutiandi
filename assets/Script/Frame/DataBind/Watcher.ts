
/**
 * @private
 */
let listeners = "__listeners__";
/**
 * @private
 */
let bindables = "__bindables__";
/**
 * @private
 */
let bindableCount = 0;
var _totalListenerList: any = {};
/**
 * @private
 *
 * @param host
 * @param property
 * @returns
 */
function getPropertyDescriptor(host: any, property: string): any {
    let data = Object.getOwnPropertyDescriptor(host, property);
    if (data) {
        return data;
    }
    let prototype = Object.getPrototypeOf(host);
    if (prototype) {
        return getPropertyDescriptor(prototype, property);
    }
    return null;
}

function notifyListener(host: any, property: string): void {
    let hostID = host[listeners];
    let list: any[] = _totalListenerList[hostID];
    let length = list ? list.length : 0;
    for (let i = 0; i < length; i += 2) {
        let listener: Function = list[i];
        let target: any = list[i + 1];
        listener.call(target, property);
    }
}
function registerBindable(instance: any, property: string): void {
    if (instance.hasOwnProperty(bindables)) {
        instance[bindables].push(property);
    }
    else {
        let list = [property];
        if (instance[bindables]) {
            list = instance[bindables].concat(list);
        }
        instance[bindables] = list;
    }
}


/**
 * Watcher 类能够监视可绑定属性的改变，您可以定义一个事件处理函数作为 Watcher 的回调方法，在每次可绑定属性的值改变时都执行此函数。
 */
export default class Watcher {

    /**
     * 创建并启动 Watcher 实例。注意：Watcher 只能监视 host 为 egret.IEventDispatcher 对象的属性改变。若属性链中某个属性所对应的实例不是 egret.IEventDispatcher，
     * 则属性链中在它之后的属性改变将无法检测到。
     * @param host 用于承载要监视的属性或属性链的对象。
     * 创建Watcher实例后，您可以利用<code>reset()</code>方法更改<code>host</code>参数的值。
     * 当<code>prop</code>改变的时候，会使得host对应的一系列<code>handlers</code>被触发。
     * @param chain 用于指定要监视的属性链的值。例如，要监视属性 host.a.b.c，需按以下形式调用此方法：watch¬(host, ["a","b","c"], ...)。
     * @param handler 在监视的目标属性链中任何属性的值发生改变时调用的事件处理函数。
     * @param thisObject handler 方法绑定的this对象
     * @returns 如果已为 chain 参数至少指定了一个属性名称，则返回 Watcher 实例；否则返回 null。
     */
    public static watch(host: any, chain: string[], handler: (value: any) => void, thisObject: any): Watcher {

        if (chain.length > 0) {
            let property = chain.shift();
            let next = Watcher.watch(null, chain, handler, thisObject);
            let watcher = new Watcher(property, handler, thisObject, next);
            watcher.reset(host);
            return watcher;
        }
        else {
            return null;
        }
    }

    /**
     * @private
     * 检查属性是否可以绑定。若还未绑定，尝试添加绑定事件。若是只读或只写属性，返回false。
     */
    private static checkBindable(host: any, property: string): boolean {
        let list: string[] = host[bindables];
        if (list && list.indexOf(property) != -1) {
            return true;
        }

        if (!host[listeners]) {
            host[listeners] = bindableCount++;
        }
        let data: PropertyDescriptor = getPropertyDescriptor(host, property);
        if (data && data.set && data.get) {
            let orgSet = data.set;
            data.set = function (value: any) {
                if (this[property] != value) {
                    orgSet.call(this, value);
                    notifyListener(this, property);
                }
            };
        }
        else if (!data || (!data.get && !data.set)) {
            bindableCount++;
            let newProp = "_" + bindableCount + property;
            host[newProp] = data ? data.value : null;
            data = <any>{ enumerable: true, configurable: true };
            data.get = function (): any {
                return this[newProp];
            };
            data.set = function (value: any) {
                if (this[newProp] != value) {
                    this[newProp] = value;
                    notifyListener(this, property);
                }
            };
        }
        else {
            return false;
        }
        Object.defineProperty(host, property, data);
        registerBindable(host, property);
    }


    /**
     * 构造函数，非公开。只能从 watch() 方法中调用此方法。有关参数用法，请参阅 watch() 方法。
     */
    public constructor(property: string, handler: (value: any) => void, thisObject: any, next?: Watcher) {
        this.property = property;
        this.handler = handler;
        this.next = next;
        this.thisObject = thisObject;
    }

    /**
     * @private
     */
    private host: any;

    /**
     * @private
     */
    private property: string;

    /**
     * @private
     */
    private handler: (value: any) => void;

    /**
     * @private
     */
    private thisObject: any;

    /**
     * @private
     */
    private next: Watcher;

    /**
     * @private
     */
    private isExecuting: boolean = false;

    /**
     * 从当前宿主中断开此 Watcher 实例及其处理函数。
     */
    public unwatch(): void {
        this.reset(null);
        this.handler = null;
        if (this.next) {
            this.next.handler = null;
        }
    }
    /**
     * 检索观察的属性或属性链的当前值，当宿主对象为空时此值为空。
     * @example
     * <pre>
     * watch(obj, ["a","b","c"], ...).getValue() === obj.a.b.c
     * </pre>
     */
    public getValue(): any {
        if (this.next) {
            return this.next.getValue();
        }
        return this.getHostPropertyValue();
    }

    /**
     * 设置处理函数。
     * @param handler 处理函数，此参数必须为非空。
     */
    public setHandler(handler: (value: any) => void, thisObject: any): void {
        this.handler = handler;
        this.thisObject = thisObject;
        if (this.next) {
            this.next.setHandler(handler, thisObject);
        }

    }

    /**
     * 重置此 Watcher 实例使用新的宿主对象。
     * 您可以通过该方法实现一个Watcher实例用于不同的宿主。
     */
    public reset(newHost: any): void {
        let oldHost = this.host;
        if (oldHost) {
            let hostID = oldHost[listeners];
            let list: any[] = _totalListenerList[hostID];
            if (list && list.length > 0) {
                let index = list.indexOf(this);
                list.splice(index - 1, 2);
                if (list.length == 0) {
                    delete _totalListenerList[hostID];
                }
            }
        }

        this.host = newHost;

        if (newHost) {
            Watcher.checkBindable(newHost, this.property);

            let hostID = newHost[listeners];

            let list: any[] = _totalListenerList[hostID];
            if (!list) {
                list = [];
                _totalListenerList[hostID] = list;
            }
            list.push(this.onPropertyChange);
            list.push(this);
        }



        if (this.next)
            this.next.reset(this.getHostPropertyValue());
    }


    /**
     * @private
     *
     * @returns
     */
    private getHostPropertyValue(): any {
        return this.host ? this.host[this.property] : null;
    }

    /**
     * @private
     */
    private onPropertyChange(property: string): void {
        if (property == this.property && !this.isExecuting) {
            try {
                this.isExecuting = true;
                if (this.next)
                    this.next.reset(this.getHostPropertyValue());
                this.handler.call(this.thisObject, this.getValue());
            }
            finally {
                this.isExecuting = false;
            }
        }
    }
}