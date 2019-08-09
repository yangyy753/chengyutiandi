import AbstractDialog, { DialogDefaultStytle, DialogDefaultOptionsTypes, DialogStyleParams } from "./AbstractDialog";
const { ccclass, property } = cc._decorator;
@ccclass
export default class CancelDialog extends AbstractDialog {
    @property({
        visible: true,
        type: cc.Label
    })
    protected _cancelButtonLabel: cc.Label = null;
    @property(
        {
            visible: true,
            type: cc.Button
        }
    )
    protected _cancelButton: cc.Button = null;
    constructor() {
        super();

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
}