import AbstractDialog, { DialogDefaultStytle, DialogDefaultOptionsTypes } from "./AbstractDialog";
const { ccclass, property } = cc._decorator;
@ccclass
export default class ConfirmDialog extends AbstractDialog {
    @property({
        visible: true,
        type: cc.Label
    })
    protected _okButtonLabel: cc.Label = null;
    @property(
        {
            visible: true,
            type: cc.Button
        }
    )

    protected _okButton: cc.Button = null;
    constructor() {
        super();
    }

    protected _updateStyle(): void {
        super._updateStyle();
        if (this._stytleParams && this._stytleParams.okButtonText) {
            if (this._okButtonLabel) {
                this._okButtonLabel.string = this._stytleParams.okButtonText;
            }
        }
        else {
            if (this._okButtonLabel) {

                this._okButtonLabel.string = DialogDefaultStytle.okButtonText;
            }
        }
    }

    get okButton() {
        return this._okButton;
    }

    public setOKButtonText(text: string) {
        if (this._okButtonLabel) {
            this._okButtonLabel.string = text;
        }
        return this;
    }
    
    public onEnable(): void {
        super.onEnable();
        this.addTouchOption(DialogDefaultOptionsTypes.DIALOG_OPTIONS_OK, this._okButton.node);
    }
}