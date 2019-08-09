import { DialogDefaultStytle, DialogDefaultOptionsTypes } from "./AbstractDialog";
import { Debug } from "../Log/LogManager";
import ConfirmDialog from "./ComfirmDialog";

const { ccclass, property } = cc._decorator;
@ccclass
export default class AskDialog extends ConfirmDialog {
    @property(
        {
            visible: true,
            type: cc.Button
        }
    )
    protected _cancelButton: cc.Button = null;
    @property(
        {
            visible: true,
            type: cc.Label
        }
    )
    protected _cancelButtonLabel: cc.Label = null;

    constructor() {
        super();

    }


    public setCancelButtonText(text: string) {
        if (this._cancelButtonLabel) {
            this._cancelButtonLabel.string = text;
        }
        return this;
    }
    protected _updateStyle(): void {
        super._updateStyle();

        if (this._stytleParams && this._stytleParams.cancelButtonText) {
            if (this._cancelButtonLabel) {
                this._cancelButtonLabel.string = this._stytleParams.cancelButtonText;
            }
        }
        else {
            if (this._cancelButtonLabel) {
                this._cancelButtonLabel.string = DialogDefaultStytle.cancelButtonText;
            }
        }

    }
    public onEnable(): void {
        super.onEnable();
        this.addTouchOption(DialogDefaultOptionsTypes.DIALOG_OPTIONS_CANCEL, this._cancelButton.node);
    }
    onDestroy() {
        Debug.Log("AskDialog is destroy")
    }
}    