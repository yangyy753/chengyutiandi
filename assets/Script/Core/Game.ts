import GameFontItem from "./GameFontItem";
import GameOptionItem from "./GameOptionItem";
import BaseComponent from "../Frame/BaseComponent";

const { ccclass, property } = cc._decorator;

@ccclass
export default class Game extends BaseComponent {

    @property(cc.Node)
    m_layout: cc.Node = null;

    @property(cc.Node)
    m_option1: cc.Node = null;

    @property(cc.Node)
    m_option2: cc.Node = null;

    @property(cc.Node)
    m_option3: cc.Node = null;

    @property(cc.Label)
    m_lblPrint: cc.Label = null;

    @property(cc.Button)
    m_btnNext: cc.Button = null;

    private _index: number = 0;
    private _right: number = 0;

    private _isRight: boolean;
    private _rightKey: string = "";
    private _rightItem: GameFontItem = null;

    private arr = [
        { "x": "马到成功", "y": "一马平川", "key": "马", "right": "马", "error1": "牛", "error2": "狗" },
        { "x": "龙飞凤舞", "y": "振翅高飞", "key": "飞", "right": "飞", "error1": "牛", "error2": "狗" },
        { "x": "碧海青天", "y": "妙手丹青", "key": "青", "right": "青", "error1": "牛", "error2": "狗" },
        { "x": "寒冬腊月", "y": "秋去冬来", "key": "冬", "right": "冬", "error1": "牛", "error2": "狗" },
        { "x": "猫哭耗子", "y": "虎踪猫迹", "key": "猫", "right": "猫", "error1": "牛", "error2": "狗" },
        { "x": "龙飞凤舞", "y": "振翅高飞", "key": "飞", "right": "飞", "error1": "牛", "error2": "狗" },
        { "x": "心有灵犀", "y": "犀牛望月", "key": "犀", "right": "犀", "error1": "神", "error2": "红" },
        { "x": "龟年鹤寿", "y": "金龟换酒", "key": "龟", "right": "龟", "error1": "福", "error2": "狗" },
    ];

    onLoad() {
        this._index = 0;
        this._rightItem = null;
        this._rightKey = "";

        let childs = this.m_layout.children;
        for (var i in childs) {
            var child = childs[i];
            child.getComponent(GameFontItem).setId(i);
        }

        this.showChengYu();
        this.showOption();
    }

    onEnable() {
        this.m_btnNext.node.on("click", this.onBtnNextClicked, this);
        this.node.on("right", this.onAnswerRight, this);
        this.node.on("wrong", this.onAnswerWrong, this);
    }

    onDisable() {
        this.m_btnNext.node.off("click", this.onBtnNextClicked, this);
        this.node.off("right", this.onAnswerRight, this);
        this.node.off("wrong", this.onAnswerWrong, this);
    }

    showChengYu() {
        if (this._index >= this.arr.length) {
            this.m_btnNext.node.active = false;
            this.m_lblPrint.string = "卧槽！你太牛逼了，通关了！！";
            return;
        }

        let data = this.arr[this._index];
        if (!data) {
            return;
        }

        this._isRight = false;
        this.m_btnNext.node.active = false;
        this.m_lblPrint.string = "";

        let x = data.y.indexOf(data.key);
        let y = data.x.indexOf(data.key);

        let xarr = data.x.split("");
        let yarr = data.y.split("");

        for (var i = 0; i < this.m_layout.children.length; i++) {
            let child = this.m_layout.children[i];
            if (i % 4 === y) {
                let idx = Math.floor(i / 4);
                let str = yarr[idx];
                if (str === data.key) {
                    this._rightItem = child.getComponent(GameFontItem);
                    this._rightItem.setText("");
                    this._rightKey = data.key;
                }
                else {
                    child.getComponent(GameFontItem).setText(str);
                }
                child.opacity = 255;
            }
            else if (Math.floor(i / 4) === x) {
                let idx = i % 4;
                let str = xarr[idx];
                if (str === data.key) {
                    this._rightItem = child.getComponent(GameFontItem);
                    this._rightItem.setText("");
                    this._rightKey = data.key;
                }
                else {
                    child.getComponent(GameFontItem).setText(str);
                }
                child.opacity = 255;
            }
            else {
                child.opacity = 0;
            }
        }
    }

    showOption() {
        if (this._index >= this.arr.length) {
            return;
        }

        let data = this.arr[this._index];
        if (!data) {
            return;
        }

        this._right = Math.floor(Math.random() * 3);
        console.log("right index:" + this._right);

        let m_optionNodes = [this.m_option1, this.m_option2, this.m_option3];
        let errIdx = 0;
        for (var i = 0; i < m_optionNodes.length; i++) {
            let option = m_optionNodes[i];
            let gameOptionItem = option.getComponent(GameOptionItem);
            if (i === this._right) {
                gameOptionItem.setText(data.right);
                gameOptionItem.setRight(true);
            }
            else {
                if (errIdx === 0) {
                    gameOptionItem.setText(data.error1);
                }
                else {
                    gameOptionItem.setText(data.error2);
                }
                gameOptionItem.setRight(false);
                errIdx++;
            }
        }
    }

    onAnswerRight() {
        this.m_lblPrint.string = "回答正确！";
        this.m_lblPrint.node.color = cc.Color.GREEN;
        this._rightItem.setRightText(this._rightKey);
        this.m_btnNext.node.active = true;
        this._isRight = true;
    }

    onAnswerWrong() {
        if (!this._isRight) {
            this.m_lblPrint.string = "回答错误，再试试？";
            // this._rightItem.setWrongText();
            this.m_lblPrint.node.color = cc.Color.RED;
        }
    }

    onBtnNextClicked() {
        this._index++;
        this.showChengYu();
        this.showOption();
    }
}
