
const { ccclass, property } = cc._decorator;

@ccclass
export default class GameFontItem extends cc.Component {

    @property(cc.Label)
    label: cc.Label = null;

    private _cid: string;

    setId(id: string) {
        this._cid = id;
    }

    getId(): string {
        return this._cid;
    }

    setText(str: string) {
        this.label.string = str;
        this.label.node.color = cc.Color.BLACK;
    }

    setRightText(str: string) {
        this.label.string = str;
        this.label.node.color = cc.Color.GREEN;
    }

    // setWrongText(str: string) {
    //     this.label.string = str;
    //     this.label.node.color = cc.Color.RED;
    // }
}
