import MVCNode from "./MVCNode";
import MVCContext from "./MVCContext";
import Model from "./Model";
import Notify from "../../Common/Notify/Notify";

export default class View extends MVCNode {
    _NotifyHandlerDict: object;

    _GetModelInterface: (name: string) => Model;
    _GetMediatorInterface: (name: string) => View;
    protected _isSceneView: boolean;

    protected _openParams: any;

    constructor(name: string) {
        super(name);
        this._NotifyHandlerDict = this.initNotifyHandlerDict();
        this._isSceneView = false;
    };

    get isSceneView() {
        return this._isSceneView;
    }
    get isSceneViewAssetLoaded() {
        return false;
    }

    public onAddToContext(context: MVCContext, getMediatorFunc: (name: string) => View, getModelFunc: (string) => Model): void {
        super.onAddToContext(context);

        this._GetMediatorInterface = getMediatorFunc;
        this._GetModelInterface = getModelFunc;
    }

    public getMediator(name: string): View | null {
        let currContext = this.getCurrContext();
        return this._GetMediatorInterface ? this._GetMediatorInterface.call(currContext, name) : null;
    }

    public getModel(name: string): Model | null {
        let currContext = this.getCurrContext();
        return this._GetModelInterface ? this._GetModelInterface.call(currContext, name) : null;
    }

    public hasNotifyObserver(ntyType: string | number): boolean {
        return this._NotifyHandlerDict[ntyType] != null;
    }

    public handlerNotify(notify: Notify): void {
        let handler = this._NotifyHandlerDict[notify.notifyType];
        handler(notify);
    }

    public initNotifyHandlerDict(): object {
        return {};
    }
    public onContextOpen(params?: any): void {
        this._openParams = params;
        super.onContextOpen(params);
    }

    public onContextActivity(params?: any): void {
        super.onContextActivity(params);
    }

    public onContextClose(): void {
        super.onContextClose();
    }
}
