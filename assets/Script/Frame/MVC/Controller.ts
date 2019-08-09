import MVCContext from "./MVCContext";
import Model from "./Model";
import MVCNode from "./MVCNode";
import Notify from "../../Common/Notify/Notify";
import View from "./View";

export default abstract class Controller extends MVCNode {
    _GetModelInterface: (name: string) => Model;
    _GetMediatorInterface: (name: string) => View;

    constructor() {
        super(Controller.prototype.constructor["name"]);
    }
    /**
     * 在通知被触发时，会创建Controller，并调用该方法，请复写
     * @param notify 
     */
    public abstract executeNotify(notify: Notify): void;


    public getMediator(name: string): View | null {
        let currContext = this.getCurrContext();
        return this._GetMediatorInterface ? this._GetMediatorInterface.call(currContext, name) : null;
    }

    public getModel<T extends Model>(name: string): T | null {
        let currContext = this.getCurrContext();
        return this._GetModelInterface ? this._GetModelInterface.call(currContext, name) : null;
    }

    public onAddToContext(context: MVCContext, getMediatorFunc: (name: string) => View, getModelFunc: (string) => Model): void {
        super.onAddToContext(context);
        this._GetMediatorInterface = getMediatorFunc;
        this._GetModelInterface = getModelFunc;
    }
    public onRemoveFromContext(context: MVCContext): void {
        super.onRemoveFromContext(context);
        this._GetMediatorInterface = null;
        this._GetModelInterface = null;
    }
}
