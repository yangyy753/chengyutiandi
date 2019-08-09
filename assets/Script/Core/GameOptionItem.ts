
const { ccclass, property } = cc._decorator;

@ccclass
export default class GameOptionItem extends cc.Component {

    @property(cc.Button)
    m_btnOption: cc.Button = null;

    @property(cc.Label)
    label: cc.Label = null;

    private _isRight: boolean;

    setRight(isRight: boolean) {
        this._isRight = isRight;
    }

    setText(str: string) {
        this.label.string = str;
        this.label.node.color = cc.Color.BLACK;
    }

    onEnable() {
        this.m_btnOption.node.on("click", this.onOptionBtnClicked, this);
    }

    onDisable() {
        this.m_btnOption.node.off("click", this.onOptionBtnClicked, this);
    }

    onOptionBtnClicked() {
        if(this._isRight)
        {
            this.node.dispatchEvent(new cc.Event.EventCustom("right", true));
        }
        else
        {
            this.node.dispatchEvent(new cc.Event.EventCustom("wrong", true));
            this.label.node.color = cc.Color.RED;
        }
        
    }
}
