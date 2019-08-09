import MVCContext from "./MVCContext";

export default interface IMVCNode {
    readonly name: string;
    onContextOpen(params?: any): void;
    onContextActivity(params?: any): void;
    onContextClose();
    setUserData(key: string, value: any): void;
    getUserData(key: string): any | null;
    getCurrContext(): MVCContext | null;
    isContextOpen(): boolean;
    onAddToContext(context: MVCContext, ...params: any[]): void;
    onRemoveFromContext(context: MVCContext): void;
    postNotify(ntfType: string, userData: any, isNextFramePost: boolean, queueName: string): void;
    postNotifyToQueue(ntfType: string, userData: any, isNextFramePost: boolean, queueName: string): void;

    nextNotifyFromQueue(queueName: string): void;
    clearNotifyQueue(queueName: string): void;
    registerNotifyQueue(queueName: string): void;
    getCurrNotifyFromQueue(queueName: string): void;
    getContextUserData(key: string): any | null;
    setContextUserData(key: string, value: any): void;


}