import { timer } from "../../Common/Time/TimerManager";
import { functionWrapper } from "../../Struct/FunctionWrapper";
import Watcher from "./Watcher";

export default class BindLink {

    protected _sourceWatcher: Watcher;
    protected _targetWatcher: Watcher;
    protected _finalTargetValue: any;
    protected _source: any;
    protected _rootTarget: any;
    protected _sourceChain: string;
    protected _targetChain: string;
    protected _finalTargetPropName: string;
    protected _finalSourceValue: any;
    constructor() {

    }
    get sourceChain() {
        return this._sourceChain;
    }
    get source() {
        return this._source;
    }
    get target() {
        return this._rootTarget;
    }
    get targetChain() {
        return this._targetChain;
    }

    /**
     * 建立一对绑定关系，在数据源和宿主的访问链上有任何变化，都将同步变化，例如host.a.b.c中的a被重新赋值、target.a.b.c中的b被重新赋值，都能同步变化
     * @param host 数据源
     * @param sourceChain 数据源访问链，例如要监视属性<code>host.a.b.c</code>,需要传递如下参数：a.b.c
     * @param target 数据源宿主
     * @param targetChain 宿主访问目标链,例如宿主访问链<code>target.a.b.c</code>,需要传递如下参数：a.b.c
     * @returns 如果绑定成功，则返回PropertyBindLink实例，否则返回null
     */
    public static CreateLink(host: any, sourceChain: string, target: any, targetChain: string): BindLink {
        let result = new BindLink();
        if (result.link(host, sourceChain, target, targetChain)) {
            return result;
        }
        else {
            result.unlink();
            return null;
        }
    }
    /**
     * 当数据源发生了变化
     * @param value 
     */
    protected onSourceValueChanged(value: any): void {
        this._finalSourceValue = this._sourceWatcher.getValue();
        if (this._finalTargetValue) {
            this._finalTargetValue[this._finalTargetPropName] = this._sourceWatcher.getValue();
        }
    }
    /**
     * 当宿主目标发生变化
     * @param value 
     */
    protected onTargetValueChange(value: any): void {
        this._finalTargetValue = value;
        if (this._finalTargetValue) {
            this._finalTargetValue[this._finalTargetPropName] = this._finalSourceValue;
        }
    }
    /**
     * 建立绑定
     * @param host 
     * @param sourceChain 
     * @param target 
     * @param targetChain 
     */
    public link(host: any, sourceChain: string, target: any, targetChain: string): boolean {
        this.unlink();
        this._sourceChain = sourceChain;
        this._source = host;
        this._rootTarget = target;
        this._targetChain = targetChain;
        this._finalTargetValue = null;
        this._sourceWatcher = null;
        this._targetWatcher = null;
        let chainArr = this._sourceChain.split(".");
        this._sourceWatcher = Watcher.watch(this._source, chainArr, null, null);
        if (this._sourceWatcher) {
            let targetChinaArr = this._targetChain.split(".");
            this._finalTargetPropName = targetChinaArr.pop();

            if (targetChinaArr.length > 0) {
                this._targetWatcher = Watcher.watch(this._rootTarget, targetChinaArr.slice(), null, null);
                if (this._targetWatcher) {
                    this._targetWatcher.setHandler(this.onTargetValueChange, this);

                    this.onTargetValueChange(this._targetWatcher.getValue());
                }
                else {
                    return false;
                }
            }
            else {
                this._finalTargetValue = this._rootTarget;
            }
            this._sourceWatcher.setHandler(this.onSourceValueChanged, this);
            timer.addNextFrameListener(functionWrapper(this.updateSourceValue, this));

            return true;
        }
        else {
            return false;
        }
    }

    protected updateSourceValue() {
        if (this._sourceWatcher && this._sourceWatcher) {
            this.onSourceValueChanged(this._sourceWatcher.getValue());
        }
    }

    public unlink() {
        if (this._sourceWatcher) {
            this._sourceWatcher.unwatch();
            this._sourceWatcher = null;
        }
        if (this._targetWatcher) {
            this._targetWatcher.unwatch();
            this._targetWatcher = null;
        }
        this._source = null;
        this._finalSourceValue = null;
        this._finalTargetValue = null;
        this._rootTarget = null;
    }
}