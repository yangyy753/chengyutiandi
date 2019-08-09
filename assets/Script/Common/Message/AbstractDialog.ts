import { IPoolItem, Pool } from "../pool/Pool";
import CommonUtils from "../utils/CommonUtils";
import FunctionWrapper, { functionWrapper } from "../../Struct/FunctionWrapper";
import Dictionary from "../../Struct/Dictionary";
import Panel from "../../Frame/Panel";
import { pool } from "../Pool/PoolManager";
import { timer } from "../Time/TimerManager";


export const enum DialogDefaultOptionsTypes {
    DIALOG_OPTIONS_NONE = 0, //无
    DIALOG_OPTIONS_OK = 1, //确定操作
    DIALOG_OPTIONS_CANCEL = 2, //取消
    DIALOG_OPTIONS_CLOSE = 3, //关闭
    DIALOG_OPTIONS_TIMEOUT = 4, //超时
    DIALOG_OPTIONS_TOUCH_OUT = 5, //点击了dialog以外的区域
    DIALOG_OPTIONS_KEY_BACK = 6 //点击了物理返回键
}

export const enum DialogTypicalTypes {
    //询问面板，包含 是、否 两个选项
    ASK = "AskPanel",
    //询问面板，包含确定一个选项
    CONFIRM = "ConfirmPanel",
    //询问面板，包含取消一个选项
    CANCEL = "CancelPanel",
    //等待面板，不包含任何选项
    MESSAGE_BOX = "MESSAGE_BOX",
    //简单提示文字提示框
    MESSAGE_WAIT_BOX = "MESSAGE_WAIT_BOX",

}

export type DialogStyleParams = {
    title?: string,
    timeout?: number, okButtonText?: string, cancelButtonText?: string, isModal?: boolean, modalMaskColor?: cc.Color
}

export type DialogOpsHandle = (opsType: string | number, dialog: AbstractDialog, ...params: any[]) => void
export type DialogOpsHandleWrapper = FunctionWrapper<DialogOpsHandle>

class DialogOptionItem implements IPoolItem {

    public opsType: number | string | DialogDefaultOptionsTypes;
    public touchNode: cc.Node;
    public timeoutNode: cc.Label;
    public timeoutID: number;
    public timeLimit: number;
    public isCloseSelf: boolean;

    public tiggerCallBack: (targetOpsItem: DialogOptionItem) => void;
    constructor() {
        this.touchNode = null;
        this.timeoutID = -1;
        this.timeoutNode = null;
        this.timeLimit = 0;
        this.isCloseSelf = true;
    }
    public onTimerInterval(tiggerCount: number, totalDuration: number): void {
        if (this.timeoutNode) {
            this.timeoutNode.string = Math.max(0, Math.ceil(this.timeLimit / 1000) - tiggerCount).toString();
        }
    }
    public onTimerComplete(evt: cc.Event): void {
        this.timeoutID = -1;
        this.tiggerCallBack(this);
    }
    public onNodeTouched(evt: cc.Event): void {
        this.tiggerCallBack(this);
    }

    public unuse(): void {
        this.tiggerCallBack = null;
        this.timeLimit = 0;
        this.timeoutID = -1;
        this.timeoutNode = null;
        this.touchNode = null;
    }


}

export var DialogDefaultStytle: DialogStyleParams = { isModal: true, title: "", timeout: 0, okButtonText: "确定", cancelButtonText: "取消", modalMaskColor: cc.color(0, 0, 0, 255 * 0.5) };
const { ccclass, property } = cc._decorator;

@ccclass
export default class AbstractDialog extends Panel {
    protected _dialogType: string | number;

    /**
     * 提示信息文本节点
     */
    @property({
        visible: true,
        type: cc.Label
    })
    protected _messageLabel: cc.Label = null;
    @property({
        visible: true,
        type: cc.Label,
        tooltip: CC_DEV && "倒计时显示文本"
    })
    protected _timeoutLabel: cc.Label = null;

    /**
     * 样式参数
     */
    protected _stytleParams: DialogStyleParams;


    protected _optionConfigItems: Dictionary;
    protected _OpsHandler: DialogOpsHandleWrapper;

    protected static _OptionItemPool: Pool;
    constructor() {
        super();
        this._optionConfigItems = new Dictionary();

    }
    onLoad() {
        super.onLoad();
    }

    setStyleParams(value: DialogStyleParams): AbstractDialog {
        this._stytleParams = value;
        if (this.enabled) {
            this._updateStyle();
        }

        return this;
    }
    public setHandler(handler: DialogOpsHandle | DialogOpsHandleWrapper): AbstractDialog {
        if (CommonUtils.IsFunction(handler)) {
            this._OpsHandler = functionWrapper(<DialogOpsHandle>handler, null);
        }
        else {
            this._OpsHandler = <DialogOpsHandleWrapper>handler;
        }

        return this;
    }
    public getHandler() {
        return this._OpsHandler;
    }
    public setDialogType(value: string | number): AbstractDialog {
        this._dialogType = value;
        return this;
    }
    get dialogType() {
        return this._dialogType;
    }

    set message(value: string) {
        if (this._messageLabel && this._messageLabel.string != value) {
            this._messageLabel.string = value ? value : "";
        }
    }

    protected _updateStyle(): void {
        if (this._stytleParams && "isModal" in this._stytleParams) {
            this.isModal = this._stytleParams.isModal;
        }
        else {
            this.isModal = "isModal" in DialogDefaultStytle ? DialogDefaultStytle.isModal : true;
        }
        if (this._stytleParams && "title" in this._stytleParams) {
            this.title = this._stytleParams.title;
        }
        else {
            this.title = DialogDefaultStytle.title;
        }
        if (this._stytleParams && "modalMaskColor" in this._stytleParams) {
            this.modalMaskColor = this._stytleParams.modalMaskColor;
        }
        else {
            this.modalMaskColor = DialogDefaultStytle.modalMaskColor;
        }

        if (this._stytleParams && "timeout" in this._stytleParams && this._stytleParams.timeout > 0) {
            if (this._timeoutLabel) {
                this._timeoutLabel.node.active = true;
                this._timeoutLabel.string = "";
            }
            this.addTimeoutOption(DialogDefaultOptionsTypes.DIALOG_OPTIONS_TIMEOUT, this._stytleParams.timeout, this._timeoutLabel);
        }
        else {
            if (this._timeoutLabel) {
                this._timeoutLabel.node.active = false;
            }
        }

    }

    public addTouchOption(optionType: number | string | DialogDefaultOptionsTypes, touchNode: cc.Node, isCloseSelf: boolean = true): void {
        let opsItem: DialogOptionItem = this._optionConfigItems.get(optionType);
        if (!opsItem) {
            if (!AbstractDialog._OptionItemPool)
                AbstractDialog._OptionItemPool = pool.registerPool("DialogOptionItem", DialogOptionItem);
            opsItem = AbstractDialog._OptionItemPool.pop();
            this._optionConfigItems.set(optionType, opsItem);
            opsItem.opsType = optionType;
            opsItem.tiggerCallBack = this.onOpsItemTigger.bind(this);
            opsItem.isCloseSelf = isCloseSelf;
        }
        else {
            opsItem.isCloseSelf = isCloseSelf;
            if (opsItem.touchNode === touchNode) {
                return;
            }
            if (opsItem.touchNode) {
                opsItem.touchNode.off(cc.Node.EventType.TOUCH_END, opsItem.onNodeTouched, opsItem);
            }
            opsItem.touchNode = null;
        }
        opsItem.touchNode = touchNode;
        if (opsItem.touchNode && this.enabled) {
            touchNode.on(cc.Node.EventType.TOUCH_END, opsItem.onNodeTouched, opsItem);
        }
    }

    public addTimeout(time: number, timeNode: cc.Label = null, isCloseSelf: boolean = true): AbstractDialog {
        this.addTimeoutOption(DialogDefaultOptionsTypes.DIALOG_OPTIONS_TIMEOUT, time, timeNode ? timeNode : this._timeoutLabel, isCloseSelf);
        return this;
    }

    public addTimeoutOption(optionType: number | string, timeout: number, timeNode: cc.Label, isCloseSelf: boolean = true): void {

        if (timeout <= 0) {

            return;
        }
        let opsItem: DialogOptionItem = this._optionConfigItems.get(optionType);
        if (!opsItem) {
            if (!AbstractDialog._OptionItemPool)
                AbstractDialog._OptionItemPool = pool.registerPool("DialogOptionItem", DialogOptionItem);
            opsItem = AbstractDialog._OptionItemPool.pop();
            this._optionConfigItems.set(optionType, opsItem);
            opsItem.opsType = optionType;
            opsItem.tiggerCallBack = this.onOpsItemTigger.bind(this);
            opsItem.isCloseSelf = isCloseSelf;
            // opsItem.timeoutNode = this._timeoutLabel;
        }
        else {
            opsItem.isCloseSelf = isCloseSelf;
            /*if( opsItem.timeLimit == timeout )
            {
                return;
            }*/
            if (opsItem.timeoutID >= 0) {
                timer.removeListener(opsItem.timeoutID);
                opsItem.timeoutID = -1;
            }

        }
        opsItem.timeoutNode = timeNode;
        opsItem.timeLimit = timeout;
        if (timeout > 0 && this.enabled) {
            if (opsItem.timeoutNode) {
                opsItem.timeoutNode.node.active = true;
                opsItem.timeoutID = timer.addTimerListener(1000, Math.ceil(timeout / 1000), functionWrapper(opsItem.onTimerInterval, opsItem), functionWrapper(opsItem.onTimerComplete, opsItem));
                opsItem.timeoutNode.string = Math.ceil(timeout / 1000).toString();
            }
            else {
                opsItem.timeoutID = timer.addTimerListener(timeout, 1, null, functionWrapper(opsItem.onTimerComplete, opsItem));
            }
        }
    }

    protected onModalMaskClick(evt: cc.Event): void {
        if (this._isTouchMaskCloseSelf) {
            if (this._OpsHandler) {
                this._OpsHandler.execute(DialogDefaultOptionsTypes.DIALOG_OPTIONS_TOUCH_OUT, this);
            }
            this.close();
        }

    }
    protected onCloseButtonClick(evt: cc.Event): void {
        if (this._OpsHandler) {
            this._OpsHandler.execute(DialogDefaultOptionsTypes.DIALOG_OPTIONS_CLOSE, this);
        }

        this.close();
    }
    protected onOpsItemTigger(targetOpsItem: DialogOptionItem): void {
        if (this._OpsHandler) {
            this._OpsHandler.execute(targetOpsItem.opsType, this);
        }
        if (targetOpsItem.isCloseSelf)
            this.close();
    }

    onEnable(): void {
        super.onEnable();
        this._updateStyle();
        let keys = this._optionConfigItems.keys;
        for (let i = 0, len = keys.length; i < len; i++) {
            let item: DialogOptionItem = this._optionConfigItems.get(keys[i])
            if (item.touchNode) {
                item.touchNode.on(cc.Node.EventType.TOUCH_END, item.onNodeTouched, item);
            }
            if (item.timeLimit > 0 && item.timeoutID == -1) {
                item.timeoutID = timer.addTimerListener(1000, item.timeLimit, functionWrapper(item.onTimerInterval, item), functionWrapper(item.onTimerComplete, item));
            }
        }
    }

    onDisable(): void {
        super.onDisable();
        let keys = this._optionConfigItems.keys;
        for (let i = 0, len = keys.length; i < len; i++) {
            let item: DialogOptionItem = this._optionConfigItems.get(keys[i]);
            if (item.touchNode) {
                item.touchNode.off(cc.Node.EventType.TOUCH_END, item.onNodeTouched, item);
            }
            if (item.timeoutID >= 0) {
                timer.removeListener(item.timeoutID);
                item.timeoutID = -1;
            }
        }
    }

    onDestroy() {
        if (this._optionConfigItems.size > 0) {
            let values: DialogOptionItem[] = this._optionConfigItems.values;
            this._optionConfigItems.clear();
            AbstractDialog._OptionItemPool.pushArray(values);
        }
    }
}