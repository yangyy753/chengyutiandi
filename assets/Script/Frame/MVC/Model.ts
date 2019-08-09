import MVCContext from "./MVCContext";
import MVCNode from "./MVCNode";

export default class Model extends MVCNode {
    _GetModelInterface: (string) => Model;
    constructor(name: string) {
        super(name);
    }

    public onAddToContext(context: MVCContext, getModelFunc: () => Model): void {
        super.onAddToContext(context);
        this._GetModelInterface = getModelFunc;
    }
    /**
     * 当所在节点被开启时回调
     */
    public onContextOpen(params?: any): void {
        super.onContextOpen(params);
    }
    /**
     * 当所在节点再次被激活时
     * @param params 
     */
    public onContextActivity(params?: any): void {
        super.onContextActivity(params);
    }
    public onContextClose(): void {
        super.onContextClose();
    }

    public getModel<T extends Model>(name: string): T | null {
        return this._GetModelInterface ? <T>this._GetModelInterface(name) : null;
    }
}
