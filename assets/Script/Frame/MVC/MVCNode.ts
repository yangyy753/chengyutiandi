import IMVCNode from "./IMVCNode";
import MVCContext from "./MVCContext";

export default class MVCNode implements IMVCNode {
    _ParentContext: MVCContext;
    _NodeName: string;
    constructor(name: string) {
        this._NodeName = name;
    }
    get name() {
        return this._NodeName;
    }

    public onContextOpen(params?: any): void {

    }
    public onContextActivity(params?: any): void {

    }
    public onContextClose() {

    }
    public setUserData(key: string, value: any): void {
        if (this._ParentContext) {
            this._ParentContext.setUserData(key, value)
        }
    }
    public getUserData(key: string): any | null {
        return this._ParentContext ? this._ParentContext.getUserData(key) : null;
    }
    public getCurrContext(): MVCContext | null {
        return this._ParentContext ? this._ParentContext.getCurrentContext() : null;
    }
    public isContextOpen(): boolean {
        return this._ParentContext && this._ParentContext.isOpen;
    }
    public onAddToContext(context: MVCContext, ...params: any[]): void {
        this._ParentContext = context;
    }
    public onRemoveFromContext(context: MVCContext): void {
        this._ParentContext = null;
    }
    public postNotify(ntfType: string, userData?: any, isNextFramePost: boolean = true, queueName?: string): void {
        if (queueName && queueName.length > 0) {
            this.postNotifyToQueue(ntfType, userData, isNextFramePost, queueName);
            return;
        }
        if (this._ParentContext) {
            this._ParentContext.postNotify(ntfType, userData, isNextFramePost);
        }
    }
    public postNotifyToQueue(ntfType: string, userData: any = null, isNextFramePost: boolean = true, queueName: string): void {

        if (this._ParentContext) {
            this._ParentContext.postNotifyToQueue(ntfType, userData, isNextFramePost, queueName);
        }
    }
    public nextNotifyFromQueue(queueName: string): void {
        if (this._ParentContext) {
            this._ParentContext.nextNotifyQueue(queueName);
        }
    }
    public clearNotifyQueue(queueName: string): void {
        if (this._ParentContext) {
            this._ParentContext.clearNotifyQueue(queueName);
        }
    }
    public registerNotifyQueue(queueName: string): void {
        if (this._ParentContext) {
            this._ParentContext.registerNotifyQueue(queueName);
        }
    }
    public getCurrNotifyFromQueue(queueName: string): void {
        if (this._ParentContext) {
            this._ParentContext.getCurrNotifyFromQueue(queueName);
        }
    }
    public getContextUserData(key: string): any | null {
        return this._ParentContext ? this._ParentContext.getUserData(key) : null;
    }

    public setContextUserData(key: string, value: any): void {
        if (this._ParentContext) {
            this._ParentContext.setUserData(key, value);
        }
    }
}
