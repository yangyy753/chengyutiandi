import BaseComponent from "./BaseComponent";
import Notify from "../Common/Notify/Notify";
import { gameGlobal } from "../GameGlobal";
import ScreenVisibleListener from "./ScreenVisibleListener";
import { SceneID } from "../Struct/SceneID";

const { ccclass, property, menu } = cc._decorator;
@ccclass
@menu("FDK/UI/VirtualScene")
export default class VirtualScene extends BaseComponent {
    public static EVENT_SCENE_ENABLED = "EVENT_SCENE_ENABLED";

    @property({
        visible: true
    })
    protected _autoReleaseAssets: boolean = true;
    @property(cc.Node)
    backgroundNode: cc.Node = null;
    bottomFillNode: cc.Node = null;

    @property(cc.Node)
    protected mContentLayer: cc.Node = null;

    protected _mySceneID: SceneID = SceneID.NONE;
    @property(cc.Button)
    protected mBackButton: cc.Button = null;

    @property({
        type: cc.Asset
    })
    dependAssets: cc.Asset[] = [];

    constructor() {
        super();
    }
    /**
     * mvc节点开启所携带的参数
     * 在接口在onEnable之前会调用
     * @param params 
     */
    public setOpenParams(params?: any) {

    }

    onLoad() {
        super.onLoad();
        let visibleListener = this.node.addComponent(ScreenVisibleListener);
        visibleListener.isEnablePosListener = false;
        if (this.mContentLayer) {
            let widget: cc.Widget = this.mContentLayer.getComponent<cc.Widget>(cc.Widget);
            if (!widget) {
                widget = this.mContentLayer.addComponent(cc.Widget);
            }
            widget.left = widget.right = 0;
            widget.top = gameGlobal.$SceneFrame.topOffset;
            widget.bottom = gameGlobal.$SceneFrame.bottomOffset;
            widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
            widget.updateAlignment();
        }
    }

    onEnable() {
        super.onEnable();

        if (this.mBackButton) {
            this.mBackButton.node.on("click", this.onBackClicked, this);
        }
    }

    onTotalEnable() {
        super.onTotalEnable();
        cc.director.once(cc.Director.EVENT_AFTER_DRAW, this.onAfterDrawEvent, this);
    }

    protected onBackClicked() {
        this.quit();
    }

    protected onAfterDrawEvent() {
        this.dispatchEvent(VirtualScene.EVENT_SCENE_ENABLED);
    }

    public setSceneId(myID: number): void {
        this._mySceneID = myID;
    }

    public getSceneID(): number {
        return this._mySceneID;
    }

    /**
     * 依赖的资源列表
     */
    getDependAssets() {
        return cc.loader.getDependsRecursively(this.node.uuid);
    }

    get autoReleaseAssets() {
        return this._autoReleaseAssets;
    }

    set autoReleaseAssets(value: boolean) {
        this._autoReleaseAssets = value;
    }

    quit(notify: Notify = null) {
        // this.dispatchEvent(GlobalUIEvents.QUIT_CURRENT_SCENE);
    }
}