import PoolItemComponent from "./PoolItemComponent";
import { PanelID } from "../Struct/PanelID";
import { gameGlobal } from "../GameGlobal";



const { ccclass, property } = cc._decorator;
@ccclass
export default class Panel extends PoolItemComponent {

    protected _PanelTag: string | number;

    protected _PanelID: PanelID = PanelID.NONE;
    /** 
     * 关闭按钮
     */
    @property({
        tooltip: CC_DEV && "关闭按钮",
        displayName: "CloseButton",
        visible: true,
        type: cc.Button
    })
    protected _closeButton: cc.Button = null;
    /**
     * 是否是模态面板
     */
    @property({
        tooltip: CC_DEV && "是否是模态",
        displayName: "IsModal",
        visible: true
    })
    protected _isModal: boolean = false;
    /**
     * 模态面板遮罩颜色
     */
    @property({
        tooltip: CC_DEV && "遮罩颜色",
        displayName: "MaskColor",
        visible: true
    })
    protected _modalMaskColor: cc.Color = cc.color(0, 0, 0, 255 * 0.7)
    protected _maskNode: cc.Node;
    /**
     * 是否点击空白区域关闭自己
     */
    @property({
        tooltip: CC_DEV && "遮罩颜色",
        displayName: "isTouchMaskCloseSelf",
        visible: true
    })
    protected _isTouchMaskCloseSelf: boolean = false;
    /**
     * 标题文本框
     */
    @property({
        tooltip: CC_DEV && "标题文本",
        displayName: "TitleLabel",
        visible: true,
        type: cc.Label
    })
    protected _titlaLabel: cc.Label = null;

    /**
     * 需要拉伸到全屏大小的背景
     */
    @property({
        tooltip: CC_DEV && "顶部填充背景",
        displayName: "BackGroundNode",
        visible: true,
        type: cc.Node
    })
    protected _backGroundNode: cc.Node = null;
    /**
     * 需要拉伸到全屏大小的背景
     */
    @property({
        tooltip: CC_DEV && "底部填充背景",
        displayName: "BottomFillBg",
        visible: true,
        type: cc.Node
    })
    protected _bottomFillBg: cc.Node = null;

    /**
     * 是否常驻场景
     */
    protected _isPersistScene: boolean;
    /**
     * 是否正在排序中
     */
    protected _isOrderMasking: boolean;

    protected _originalSize: cc.Size;

    /**
     *  如果此参数不为空，则只有在此参数下的场景。panel才会正常展示，否则onenable时就关掉
     */
    protected _dependentScene: string[] = []

    constructor() {
        super();
        this._isPersistScene = false;
        this._isModal = false;
        this._modalMaskColor = cc.color(0, 0, 0, 255 * 0.5);
        this._isTouchMaskCloseSelf = false;
        this._isOrderMasking = false;
        this._originalSize = cc.size(0, 0);
    }

    onLoad() {
        super.onLoad();
        let nodeSize = this.node.getContentSize();
        this._originalSize.width = nodeSize.width;
        this._originalSize.height = nodeSize.height;

        //适配
        if (this._backGroundNode) {
            let widget: cc.Widget = this._backGroundNode.getComponent<cc.Widget>(cc.Widget);
            if (!widget) {
                widget = this._backGroundNode.addComponent(cc.Widget);
            }
            // widget.isAlignOnce = false;
            // widget.alignMode = cc.Widget.AlignMode.ALWAYS;
            widget.left = widget.right = 0;
            widget.top = gameGlobal.$SceneFrame.topOffset * -2
            widget.bottom = gameGlobal.$SceneFrame.bottomOffset * -2;
            widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
            widget.updateAlignment();


        }

        if (this._bottomFillBg) {
            let widget: cc.Widget = this._bottomFillBg.getComponent<cc.Widget>(cc.Widget);
            if (!widget) {
                widget = this._bottomFillBg.addComponent(cc.Widget);
            }
            // widget.isAlignOnce = false;
            // widget.alignMode = cc.Widget.AlignMode.ALWAYS;
            widget.left = widget.right = 0;
            widget.bottom = gameGlobal.$SceneFrame.bottomOffset * -2
            widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
            widget.updateAlignment();
        }
    }

    set panelTag(value: string | number) {
        this._PanelTag = value;
    }

    get panelTag(): string | number {
        return this._PanelTag;
    }

    set panelID(value: number) {
        this._PanelID = value;
    }
    get panelID(): number {
        return this._PanelID;
    }

    set title(value: string) {
        if (this._titlaLabel)
            this._titlaLabel.string = value;
    }

    set isModal(value: boolean) {
        if (this._isModal != value || (this._isModal && (!this._maskNode || !this._maskNode.parent))) {
            this._isModal = value;
            this._updateModal();
            this._updateMaskOrder();
        }
    }


    set modalMaskColor(value: cc.Color) {
        if (!this._modalMaskColor.equals(value)) {
            this._modalMaskColor = value.clone();
            this._updateModalMaskColor();
        }
    }
    
    protected _updateModalMaskColor(graphics?: cc.Graphics): void {
        if (!graphics) {
            graphics = this._maskNode ? this._maskNode.getComponent(cc.Graphics) : null;
        }
        if (graphics && !this._modalMaskColor.equals(graphics.fillColor)) {
            graphics.clear();
            graphics.fillColor = this._modalMaskColor.clone();
            graphics.rect(this._maskNode.width * -0.5, this._maskNode.height * -0.5, this._maskNode.width, this._maskNode.height);
            graphics.fill();
        }
    }

    protected _updateModal(): void {
        if (this._isModal) {//模态，动态创建一个底板
            //let graphics:cc.Graphics = null;
            if (!this._maskNode) {
                this._maskNode = new cc.Node();
                this._maskNode.addComponent(cc.BlockInputEvents);
                this._maskNode.addComponent(cc.Graphics);
                let winSize = cc.view.getVisibleSize();
                winSize.width /= gameGlobal.$SceneFrame.sceneScale;
                winSize.width *= 1.5;
                winSize.height /= gameGlobal.$SceneFrame.sceneScale;
                winSize.height *= 1.5;
                this._maskNode.setContentSize(winSize);
            }

            this._updateModalMaskColor();
            if (!this._maskNode.parent) {
                this.node.addChild(this._maskNode);
                this._maskNode.setSiblingIndex(0);
            }

            if (this._isTouchMaskCloseSelf) {
                this._maskNode.on(cc.Node.EventType.TOUCH_END, this.onModalMaskClick, this);
            }
        }
        else {//非模态
            if (this._maskNode) {
                this._maskNode.removeFromParent(false);
                if (this._isTouchMaskCloseSelf) {
                    this._maskNode.off(cc.Node.EventType.TOUCH_END, this.onModalMaskClick, this);
                }
            }
        }
    }
    protected _updateMaskOrder(): void {
        if (this._maskNode && this._maskNode.parent && this.node.parent) {
            if (this._isOrderMasking)
                return;
            this._isOrderMasking = true;
            this._maskNode.setSiblingIndex(0);
            this._isOrderMasking = false;
        }
    }

    protected _onChildRecorder(evt: cc.Event): void {
        this._updateMaskOrder();
    }


    onEnable(): void {
        super.onEnable();
        if (this._closeButton) {
            this._closeButton.node.on(cc.Node.EventType.TOUCH_END, this.onCloseButtonClick, this);
        }

        this._updateModal();
        this._updateMaskOrder();

        this.node.on('child-reorder', this._onChildRecorder, this);
        this.node.on('child-added', this._onChildRecorder, this);
    }

    onDisable(): void {
        super.onDisable();
        this.node.off('child-reorder', this._onChildRecorder, this);
        this.node.off('child-added', this._onChildRecorder, this);
        if (this._maskNode) {
            this._maskNode.off(cc.Node.EventType.TOUCH_END, this.onModalMaskClick, this);
        }
        if (this._closeButton) {
            this._closeButton.node.off(cc.Node.EventType.TOUCH_END, this.onCloseButtonClick, this);
        }

        this.removeAllNotify();
    }

    public close(): void {
        this.node.removeFromParent(false);
    }
    protected onCloseButtonClick(evt: cc.Event): void {
        this.close();
    }
    protected onModalMaskClick(evt: cc.Event.EventTouch): void {
        evt.stopPropagationImmediate();
        let boundBox = this._maskNode.getBoundingBoxToWorld();
        let localPos = this.node.convertToNodeSpace(evt.getLocation());
        if (this._isTouchMaskCloseSelf &&
            localPos.x < 0 || localPos.x > this._originalSize.width ||
            localPos.y < 0 || localPos.y > this._originalSize.height) {
            this.close();
        }

    }

    public onDestroy(): void {
        if (this._maskNode && this._maskNode.isValid) {
            this._maskNode.destroy();
            this._maskNode = null;
        }
    }
}