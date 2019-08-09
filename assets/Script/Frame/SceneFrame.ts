import TMap from "../Struct/TMap";
import Dictionary from "../Struct/Dictionary";
import { functionWrapper } from "../Struct/FunctionWrapper";
import { asset, NODE_KEY_SOURCE_ASSET_ID } from "../Common/Res/AssetManager";
import AbstractDialog, { DialogStyleParams, DialogOpsHandle, DialogOpsHandleWrapper } from "../Common/Message/AbstractDialog";
import CommonUtils from "../Common/utils/CommonUtils";
import AskDialog from "../Common/Message/AskDialog";
import ConfirmDialog from "../Common/Message/ComfirmDialog";
import Panel from "./Panel";
import { msg } from "../Common/Message/MessageManager";
import { gameGlobal } from "../GameGlobal";
import { SceneNodeLoader } from "./SceneNodeLoader";
import CancelDialog from "../Common/Message/CancelDialog";
import { timer } from "../Common/Time/TimerManager";
import ScreenVisibleListener from "./ScreenVisibleListener";
import BaseComponent from "./BaseComponent";
import { registerClass } from "../Common/Utils/ReflectionUtils";
import { pool } from "../Common/Pool/PoolManager";

enum SceneFrameEvents {
    INITED = "INITED",
    SCENE_LOAD = "SCENE_LOAD",
    SCENE_SWITCH = "SCENE_SWITCH"
}

/**
* GUI 显示层级，数字越大，层级越高
*/
export const enum GUILevels {
    Background = 100,
    ForeGround = 200,
    PopupGrounnd = 300,
    System = 400,
    Debug = 500
}

export type PanelShowParams = { dialogStyle?: DialogStyleParams, isPersist?: boolean, queueName?: string, isTagOnly?: boolean, isGlobalOnly?: boolean, layerLevel?: GUILevels };

type NodeItem = { node: cc.Node, prefabName: string, panelTag: string, className: string, targetLayer: GUILevels, isPersist: boolean }

const NODE_TAG_KEY = "__LocalTag__"

const { ccclass, property } = cc._decorator
@ccclass
export default class SceneFrameA extends BaseComponent {

    private _mainLayer: cc.Node;

    private _sceneContainer: cc.Node;

    private _backgroundLayer: cc.Node = null;

    private _contentLayer: cc.Node = null;

    private _foregroundLayer: cc.Node = null;

    private _popupLayer: cc.Node = null;

    private _systemLayer: cc.Node = null;

    private _debugLayer: cc.Node = null;

    protected _defaultAskPanel: cc.Prefab = null;
    protected _defaultConfirmPanel: cc.Prefab = null;
    protected _defaultCancelPanel: cc.Prefab = null;
    protected _defaultMessagePanel: cc.Prefab = null;
    protected _defaultWaitMessagePanel: cc.Prefab = null;

    protected _maxScaleFactor: number;

    protected _totalLayer: TMap<GUILevels, cc.Node>;

    protected _scenesStack: SceneNodeLoader[];
    protected _nextScene: SceneNodeLoader;
    protected _runningScene: SceneNodeLoader;

    protected _loadingScene: any;

    protected _defaultPanelDependAssets: string[];

    protected _currSceneSnapshot: cc.Node;

    protected _isAsyncNodeLoading: number;

    protected _gcDelayTimerID: number;
    protected _sceneSize: cc.Size;
    public get sceneSize(): cc.Size {
        return this._sceneSize;
    }

    public get sceneScale(): number {
        return this._sceneContainer.scale
    }

    public get sceneOffsetY(): number {
        return this._sceneContainer.y
    }

    protected _sceneFrameAutoReleaseMap: Dictionary;

    protected _isImmediateSwitchScene: boolean;

    protected _queueNodeMap: any;

    protected mTopOffset: number;

    protected mBottomOffset: number;

    protected mValidSceneWorldRect: cc.Rect;
    constructor() {
        super();
        this._isAsyncNodeLoading = 0;
        this._sceneFrameAutoReleaseMap = new Dictionary();
        this._gcDelayTimerID = -1;
        this._isImmediateSwitchScene = true;
        this._queueNodeMap = {};
        this.mTopOffset = this.mBottomOffset = 0;
    }

    get topOffset() {
        return this.mTopOffset;
    }

    get bottomOffset() {
        return this.mBottomOffset;
    }

    public onLoad(): void {
        super.onLoad();

        let designResolution = cc.Canvas.instance.designResolution;
        let visibleSize = cc.view.getVisibleSize();
        let visibleSizeInPixel = cc.view.getVisibleSizeInPixel();
        let frameSize = cc.view.getFrameSize();
        let currScale = visibleSize.height / visibleSize.width;
        let topOffset = 0;
        let bottomOffset = 0;
        let targetScale = 1;
        let offsetY = 0;
        let size = visibleSize.clone();
        let maxScale = 2;
        let minScale = 1136 / 640;
        if (currScale > maxScale) {
            topOffset = 35;
            if (frameSize.width == 375 && frameSize.height == 812) {
                bottomOffset = 15;  //ipx bottom fix
            }
            let sc = (visibleSize.height / frameSize.height);
            topOffset = Math.ceil(topOffset * sc);
            bottomOffset = Math.ceil(bottomOffset * sc);
            offsetY = topOffset * -0.5 + bottomOffset * 0.5;
        }
        else if (currScale < minScale) {
            targetScale = visibleSize.height / 1136
            size = cc.size(640, 1136)

            offsetY = 0
        }
        this.mTopOffset = topOffset;
        this.mBottomOffset = bottomOffset;

        size.width = Math.ceil(size.width);
        size.height = Math.ceil(size.height);

        let validSize = size.clone();
        validSize.height -= topOffset + bottomOffset;

        this._sceneSize = size;
        this._mainLayer = new cc.Node();
        this.node.addChild(this._mainLayer);
        this._mainLayer.width = this.node.width;
        this._mainLayer.height = this.node.height;

        this._totalLayer = new TMap<GUILevels, cc.Node>();
        this._scenesStack = [];

        this._sceneContainer = new cc.Node();
        this._sceneContainer.setContentSize(size);
        if (targetScale != 1) {
            this._sceneContainer.addComponent(cc.Mask);
        }

        this._mainLayer.addChild(this._sceneContainer);

        this._sceneContainer.scale = targetScale

        this._backgroundLayer = new cc.Node();
        this._backgroundLayer.setContentSize(size);

        this._sceneContainer.addChild(this._backgroundLayer);

        this._contentLayer = new cc.Node();
        this._contentLayer.addComponent(cc.BlockInputEvents);
        this._contentLayer.setContentSize(size);
        this._sceneContainer.addChild(this._contentLayer);

        this._currSceneSnapshot = new cc.Node();
        this._currSceneSnapshot.addComponent(cc.BlockInputEvents);
        this._currSceneSnapshot.width = this._sceneContainer.width;
        this._currSceneSnapshot.height = this._sceneContainer.height;

        this._sceneContainer.addChild(this._currSceneSnapshot);
        this._currSceneSnapshot.active = false;

        this._foregroundLayer = new cc.Node();
        this._foregroundLayer.setContentSize(validSize);
        this._foregroundLayer.y = offsetY;
        this._sceneContainer.addChild(this._foregroundLayer);

        this._popupLayer = new cc.Node();
        this._popupLayer.setContentSize(validSize);
        this._popupLayer.y = offsetY;
        this._sceneContainer.addChild(this._popupLayer);

        this._systemLayer = new cc.Node();
        this._systemLayer.setContentSize(validSize);
        this._systemLayer.y = offsetY;
        this._sceneContainer.addChild(this._systemLayer);

        this._debugLayer = new cc.Node();
        this._debugLayer.setContentSize(size);
        this._sceneContainer.addChild(this._debugLayer);

        this._totalLayer.set(GUILevels.Background, this._backgroundLayer);
        this._totalLayer.set(GUILevels.ForeGround, this._foregroundLayer);
        this._totalLayer.set(GUILevels.PopupGrounnd, this._popupLayer);
        this._totalLayer.set(GUILevels.System, this._systemLayer);
        this._totalLayer.set(GUILevels.Debug, this._debugLayer);

        this._backgroundLayer.on(cc.Node.EventType.CHILD_REMOVED, this.onBackLayerChildRemoved, this);
        this._foregroundLayer.on(cc.Node.EventType.CHILD_REMOVED, this.onForeLayerChildRemoved, this);
        this._popupLayer.on(cc.Node.EventType.CHILD_REMOVED, this.onPopupLayerChildRemoved, this);
        this._systemLayer.on(cc.Node.EventType.CHILD_REMOVED, this.onSystemLayerChildRemoved, this);
        this._debugLayer.on(cc.Node.EventType.CHILD_REMOVED, this.onDebugLayerChildRemoved, this);
        this._backgroundLayer.on(cc.Node.EventType.CHILD_ADDED, this.onLayerChildAdded, this);
        this._foregroundLayer.on(cc.Node.EventType.CHILD_ADDED, this.onLayerChildAdded, this);
        this._popupLayer.on(cc.Node.EventType.CHILD_ADDED, this.onLayerChildAdded, this);
        this._popupLayer.on(cc.Node.EventType.CHILD_ADDED, this.onLayerChildAdded, this);
        this._systemLayer.on(cc.Node.EventType.CHILD_ADDED, this.onLayerChildAdded, this);
        this._debugLayer.on(cc.Node.EventType.CHILD_ADDED, this.onLayerChildAdded, this);

        this.node.emit(SceneFrameEvents.INITED);
    }

    get validSceneRect() {
        return cc.rect(0, 0, this._sceneContainer.width, this._sceneContainer.height)
    }

    get validSceneWorldRect() {
        let sceneWidth = this._sceneContainer.width * this._sceneContainer.scaleX;
        let sceneHeight = this._sceneContainer.height * this._sceneContainer.scaleY;
        return cc.rect((this.node.width - sceneWidth) * 0.5, 0, sceneWidth, sceneHeight);
    }

    get runningScene() {
        return this._runningScene;
    }

    public registerDefaultAskPanel(panel: cc.Prefab): void {
        this._defaultAskPanel = panel;
        pool.registerPrefabPool(this._defaultAskPanel, 4);
    }

    public registerDefaultConfirmPanel(panel: cc.Prefab): void {
        this._defaultConfirmPanel = panel;
        pool.registerPrefabPool(this._defaultConfirmPanel, 4);
    }
    public registerDefaultCancelPanel(panel: cc.Prefab): void {
        this._defaultCancelPanel = panel;
        pool.registerPrefabPool(this._defaultCancelPanel, 4);
    }
    public registerDefaultMessagePanel(panel: cc.Prefab): void {
        this._defaultMessagePanel = panel;
        pool.registerPrefabPool(this._defaultMessagePanel, 4);
    }
    public registerDefaultWaitMessagePanel(panel: cc.Prefab): void {
        this._defaultWaitMessagePanel = panel;
        pool.registerPrefabPool(this._defaultWaitMessagePanel, 4);
    }

    get defaultWaitMessagePanel() {
        return this._defaultWaitMessagePanel;
    }

    protected onLayerChildAdded(targetNode: cc.Node): void {
        if (!pool.hasRegisterPool(targetNode.name)) {
            let assetUUID = targetNode[NODE_KEY_SOURCE_ASSET_ID];
            if (assetUUID) {
                asset.reatinAssetReference(assetUUID, cc.Prefab);
            }
        }


        let guiLevel: GUILevels = this._totalLayer.findKey(targetNode.parent);
        if (guiLevel == GUILevels.Debug) {
            return;
        }

        let index = this._sceneContainer.children.indexOf(targetNode.parent);
        if (index >= 0) {
            let childIndex = targetNode.parent.children.indexOf(targetNode)
            for (let i = childIndex - 1; i >= 0; i--) {
                let comList: ScreenVisibleListener = targetNode.parent.children[i].getComponent(ScreenVisibleListener)
                for (let key in comList) {
                    comList[key].beConvered = true;
                }
            }
            for (let i = index - 1; i >= 0; i--) {
                let comList: ScreenVisibleListener[] = this._sceneContainer.children[i].getComponentsInChildren(ScreenVisibleListener)
                for (let key in comList) {
                    comList[key].beConvered = true;
                }
            }
        }
    }

    protected onBackLayerChildRemoved(targetNode: cc.Node) {
        this.onLayerChildRemoved(targetNode, this._backgroundLayer);
    }

    protected onForeLayerChildRemoved(targetNode: cc.Node) {
        this.onLayerChildRemoved(targetNode, this._foregroundLayer);
    }

    protected onPopupLayerChildRemoved(targetNode: cc.Node) {
        this.onLayerChildRemoved(targetNode, this._popupLayer);
    }

    protected onSystemLayerChildRemoved(targetNode: cc.Node) {
        this.onLayerChildRemoved(targetNode, this._systemLayer);
    }

    protected onDebugLayerChildRemoved(targetNode: cc.Node) {
        this.onLayerChildRemoved(targetNode, this._debugLayer);
    }

    /**
     * 当有子元素被删除
     * 1.检测是否可以被回收
     * 2.检测遮挡性（webview）
     * @param evt 
     */
    protected onLayerChildRemoved(targetNode: cc.Node, oldParent: cc.Node): void {
        if (targetNode["__CurrShowQueueName__"]) {
            let queueName = targetNode["__CurrShowQueueName__"];
            delete targetNode["__CurrShowQueueName__"];
            if (queueName in this._queueNodeMap) {
                let nodeList: cc.Node[] = this._queueNodeMap[queueName];
                let index = nodeList.lastIndexOf(targetNode);
                if (index >= 0) {
                    nodeList.splice(index, 1);
                    if (nodeList.length > 0) {
                        let newNode = nodeList[0]
                        newNode.active = true
                    }
                }
            }
            targetNode.active = true;
        }
        if (pool.hasRegisterPool(targetNode.name) && targetNode.isValid) {
            pool.push(targetNode, targetNode.name);
        }
        else {
            if (targetNode.isValid) {
                targetNode.destroy();
            }
            let assetUUID = targetNode[NODE_KEY_SOURCE_ASSET_ID];
            if (assetUUID) {
                // gameGlobal.$AssetManager.releaseAssetReference(assetUUID, cc.Prefab);
            }
        }

        let guiLevel: GUILevels = this._totalLayer.findKey(oldParent);
        if (guiLevel == GUILevels.Debug) {
            return;
        }
        do {
            let index = this._sceneContainer.children.indexOf(oldParent);
            if (index >= 0) {
                let lastNode: cc.Node = null;
                if (oldParent.childrenCount > 0) {
                    lastNode = oldParent.children[oldParent.childrenCount - 1];
                }
                else {
                    for (let i = index - 1; i >= 0; i--) {
                        let layer = this._sceneContainer.children[i];
                        if (layer.childrenCount > 0) {
                            lastNode = layer.children[layer.childrenCount - 1];
                            break;
                        }
                    }
                }
                if (lastNode) {
                    let comList: ScreenVisibleListener[] = lastNode.getComponentsInChildren(ScreenVisibleListener)
                    for (let key in comList) {
                        comList[key].beConvered = false;
                    }
                }
            }
        } while (false);
    }
    /**
     * 显示一个元素到某个层
     * @param node 显示元素
     * @param levels 显示层级
     * @param isPersist 是否常驻场景
     * @param queueName 队列名字，用于依次显示，避免扎堆
     */
    public showNodeTo(node: cc.Node | string, level: GUILevels, isPersist: boolean = false, queueName: string = null): cc.Node {
        let targetNode: cc.Node;

        if (CommonUtils.IsString(node)) {
            let prefab: cc.Prefab = cc.loader.getRes(<string>node);
            if (prefab) {
                targetNode = cc.instantiate(prefab);
                targetNode.name = prefab.name;
                targetNode[NODE_TAG_KEY] = prefab.name;
            }
        }
        else {
            targetNode = <cc.Node>node;
            if (!(NODE_TAG_KEY in targetNode)) {
                targetNode[NODE_TAG_KEY] = targetNode.name;
            }
        }
        if (targetNode) {
            targetNode["__isPersist__"] = isPersist;
            let targetLayer: cc.Node = this._totalLayer.get(level);
            if (queueName && queueName.length > 0) {
                targetNode["__CurrShowQueueName__"] = queueName;
                if (queueName in this._queueNodeMap) {
                    let nodeList = this._queueNodeMap[queueName];
                    if (nodeList.length > 0) {
                        targetNode.active = false
                    }
                    this._queueNodeMap[queueName].push(targetNode);
                }
                else {
                    this._queueNodeMap[queueName] = [targetNode];
                }
            }
            targetLayer.addChild(targetNode);
        }
        return targetNode;
    }
    public showNodeToAsync(nodeName: string, callFunc: (node: cc.Node) => void, level: GUILevels, isPersist: boolean = false, queueName: string = null): void {
        let node = cc.loader.getRes(nodeName);
        if (!node) {
            msg.Tips("正在加载...", 30000, null, "ResLoading");
            //开始加载前引用资源名字
            this._isAsyncNodeLoading++;

            let currSceneID = this._runningScene.instanceID;
            cc.loader.loadRes(nodeName, function (error: Error, resource: any) {
                this._isAsyncNodeLoading--;
                if (!isPersist && gameGlobal.$SceneFrame.runningScene.instanceID != currSceneID) {//场景已经切换了
                    return;
                }
                console.log("Node加载完成:" + nodeName, error);
                gameGlobal.removePanelWithTag("ResLoading");
                if (!error) {
                    let node = cc.instantiate(resource);
                    node.name = resource.name;
                    node[NODE_TAG_KEY] = nodeName;
                    this.showNodeTo(node, level, isPersist, queueName);
                    if (callFunc) {
                        callFunc(node);
                    }
                }

            }.bind(this));
        }
        else {
            let targetNode = cc.instantiate(node);
            targetNode.name = node.name;
            targetNode[NODE_TAG_KEY] = nodeName;
            this.showNodeTo(targetNode, level, isPersist, queueName);

            if (callFunc) {
                callFunc(targetNode);
            }

        }
    }

    /**
     * 显示一个预制体节点，会从缓冲池中获取
     * @param {cc.Prefab} prefab
     * @param {GUILevels} level
     * @param {boolean} isPersist
     * @return {cc.Node}
     */
    public showPrefabTo(prefab: cc.Prefab | string, level: GUILevels, isPersist: boolean = false, queueName: string = null): cc.Node {
        let node = pool.pop(prefab instanceof cc.Prefab ? prefab.name : prefab);
        if (!node) {
            if (prefab instanceof cc.Prefab)
                node = cc.instantiate(prefab);
            node.name = (<cc.Prefab>prefab).name;
        }
        if (node)
            this.showNodeTo(node, level, isPersist, queueName)
        return node;
    }
    /**
     * 显示一个默认的面板。
     * 将从缓冲池中获取显示对象，显示层级默认为Popup，isTagOnly默认为true，也就是说会将其他相同tag的面板移除
     * @param dialogClass 面板类
     * @param msg 消息文本
     * @param handler 回调处理
     * @param tag 标签
     * @param params 显示附加参数
     */
    public showDefaultDialog<T extends AbstractDialog>(prefab: cc.Prefab, msg: string, handler: DialogOpsHandle | DialogOpsHandleWrapper, tag: string | number, params: PanelShowParams): T {
        if (!prefab) {
            return null;
        }
        if (params) {
            if (params.isGlobalOnly) {
                this.removeTotalPanel();
            }
            else if (params.isTagOnly == undefined || params.isTagOnly) {//默认是类型唯一
                this.removePanelWithTag(tag);
            }
        } else {
            //默认是类型唯一(即使不传附加参数)
            this.removePanelWithTag(tag);
        }
        let dialogComponentNode: cc.Node = pool.pop(prefab.name);
        let dialogComponent = <T>dialogComponentNode.getComponent<AbstractDialog>(AbstractDialog)
        dialogComponent.setHandler(handler).setDialogType(tag).message = msg;
        dialogComponent.setStyleParams(params ? params.dialogStyle : null);
        let targetLevel = (params && ("layerLevel" in params)) ? params.layerLevel : GUILevels.PopupGrounnd;
        dialogComponent.node[NODE_TAG_KEY] = tag;
        this.showNodeTo(dialogComponent.node, targetLevel, params && params.isPersist, params ? params.queueName : null);
        return dialogComponent;
    }

    /**
     * 显示一个标准等待消息面板，没有用户点击选项，一般设置超时将其移除.可以传递params.dialogStyle参数定制外观。
     * 将从缓冲池中获取显示对象，显示层级默认为Popup，isTagOnly默认为true，也就是说会将其他相同tag的面板移除
     * @param timeout 超时（豪秒）
     * @param msg 消息文本
     * @param handler 回调处理
     * @param tag 标签
     * @param params 显示附加参数
     */
    public showMessagePanel(msg: string, timeout: number, handler: DialogOpsHandle | DialogOpsHandleWrapper, tag: string | number, params: PanelShowParams): AbstractDialog {
        if (!params) {
            params = { dialogStyle: { timeout: timeout } };
        }
        else {
            if (params.dialogStyle) {
                params.dialogStyle.timeout = timeout;
            }
            else {
                params.dialogStyle = { timeout: timeout };
            }
        }
        return this.showDefaultDialog(this._defaultWaitMessagePanel, msg, handler, tag, params);
    }

    /**
     * 显示一个标准询问面板，有是和否两个选项。可以传递params.dialogStyle参数定制外观。
     * 将从缓冲池中获取显示对象，显示层级默认为Popup，isTagOnly默认为true，也就是说会将其他相同tag的面板移除
     * @param msg 消息文本
     * @param handler 回调处理
     * @param tag 标签
     * @param params 显示附加参数
     * @returns 
     */
    public showAskDialog(msg: string, handler: DialogOpsHandle | DialogOpsHandleWrapper, tag: string | number, params: PanelShowParams): AskDialog {

        return this.showDefaultDialog(this._defaultAskPanel, msg, handler, tag, params);
    }
    /**
     * 显示一个标准确认面板，只有一个确定选项.可以传递params.dialogStyle参数定制外观。
     * 将从缓冲池中获取显示对象，显示层级默认为Popup，isTagOnly默认为true，也就是说会将其他相同tag的面板移除
     * @param msg 消息文本
     * @param handler 回调处理
     * @param tag 标签
     * @param params 显示附加参数
     */
    public showConfirmDialog(msg: string, handler: DialogOpsHandle | DialogOpsHandleWrapper, tag: string | number, params: PanelShowParams): ConfirmDialog {
        return this.showDefaultDialog(this._defaultConfirmPanel, msg, handler, tag, params);
    }
    /**
   * 显示一个标准确认面板，只有一个取消选项.可以传递params.dialogStyle参数定制外观。
   * 将从缓冲池中获取显示对象，显示层级默认为Popup，isTagOnly默认为true，也就是说会将其他相同tag的面板移除
   * @param msg 消息文本
   * @param handler 回调处理
   * @param tag 标签
   * @param params 显示附加参数
   */
    public showCancelDialog(msg: string, handler: DialogOpsHandle | DialogOpsHandleWrapper, tag: string | number, params: PanelShowParams): CancelDialog {
        return this.showDefaultDialog(this._defaultCancelPanel, msg, handler, tag, params);
    }

    public findPanelComponent<T extends cc.Component>(panelTag: string | number, componentClass: { prototype: T }): T[] {
        let arr = panelTag.toString().split("/");
        let simpleName = arr[arr.length - 1];
        let nodes: cc.Node[] = this.findNodeFromTotalLayer(function (node: cc.Node): boolean {
            if (node[NODE_TAG_KEY] == panelTag || simpleName == node[NODE_TAG_KEY]) {
                return true;
            }
            return false;
        })
        let result: T[] = [];
        for (let i = 0, len = nodes.length; i < len; i++) {
            let component = nodes[i].getComponent<T>(componentClass);
            if (component) {
                result.push(component);
            }
        }
        return result;
    }
    public findPanel(panelTag: string | number): cc.Node[] {
        let arr = panelTag.toString().split("/");
        let simpleName = arr[arr.length - 1];
        let nodes: cc.Node[] = this.findNodeFromTotalLayer(function (node: cc.Node): boolean {
            if (node[NODE_TAG_KEY] == panelTag || simpleName == node[NODE_TAG_KEY]) {
                return true;
            }
            return false;
        });
        return nodes;
    }

    public findPanelWithID(panelID: number): Panel[] {


        let nodes: cc.Node[] = this.findNodeFromTotalLayer(function (node: cc.Node): boolean {
            if (node.getComponent(Panel)) {
                return true;
            }
            return false;
        });

        let result: Panel[] = []
        for (let i = 0, len = nodes.length; i < len; i++) {
            let component: Panel = nodes[i].getComponent<Panel>(Panel);
            if (component && component.panelID == panelID) {
                result.push(component);
            }
        }
        return result;
    }

    /**
     * 删除某种类型的面板
     * @param tag 特征标签
     */
    public removePanelWithTag(tag: string | number): number {
        let count = 0;
        let keys = this._totalLayer.keys;
        for (let i = 0, len = keys.length; i < len; i++) {
            count += this.removePanelFromLayer(tag, keys[i]);
        }
        return count;
    }
    /**
     * 删除某种层级内某类型的面板(带有Panel组件)
     * @param tag 特征标签
     */
    public removePanelFromLayer(panelTag: string | number, guiLayer: GUILevels): number {
        let arr = panelTag.toString().split("/");
        let simpleName = arr[arr.length - 1];
        return this.removeNodeFromLayer(guiLayer, function (node: cc.Node): boolean {
            if (node[NODE_TAG_KEY] == panelTag || simpleName == node[NODE_TAG_KEY]) {
                let panelComponent = node.getComponents(Panel)
                if (panelComponent) {
                    return true;
                }
            }
            return false;
        });
    }
    /**
     * 清除某个层级内所有的面板，只会清除带有Panel组件的元素
     */
    public clearPanelFromLayer(guiLayer: GUILevels): number {
        return this.removeNodeFromLayer(guiLayer, function (node: cc.Node): boolean {
            let panelComponent = node.getComponents(Panel)
            if (panelComponent && !node["__isPersist__"]) {
                return true;
            }
            return false;
        });
    }
    /**
     * 清除所有层级内所有的面板，只会清除带有Panel组件的元素
     */
    public removeTotalPanel(): void {
        let keys = this._totalLayer.keys;
        for (let i = 0, len = keys.length; i < len; i++) {
            this.clearPanelFromLayer(keys[i]);
        }
    }
    /**
     * 从某一个层中删除显示对象
     * @param layerLevel    层级
     * @param conditionFunc 条件函数，返回true则删除该元素，如果为空，则表示删除全部元素
     */
    public removeNodeFromLayer(layerLevel: GUILevels, conditionFunc: (node: cc.Node) => boolean): number {
        let removeNodes = this.findNodeFromLayer(layerLevel, conditionFunc);
        for (let i = 0, len = removeNodes.length; i < len; i++) {
            removeNodes[i].removeFromParent(false);
        }
        return removeNodes.length;
    }
    /**
     * 从所有层中删除复合条件的元素
     * @param conditionFunc 条件函数
     */
    public removeNodeFromTotalLayer(conditionFunc: (node: cc.Node) => boolean): number {
        let removeNodes = this.findNodeFromTotalLayer(conditionFunc);
        for (let i = 0, len = removeNodes.length; i < len; i++) {
            removeNodes[i].removeFromParent(false);
        }
        return removeNodes.length;
    }

    public findNodeFromLayer(layerLevel: GUILevels, conditionFunc: (node: cc.Node) => boolean): cc.Node[] {
        let result: cc.Node[] = []
        let layer: cc.Node = this._totalLayer.get(layerLevel);
        for (let i = layer.childrenCount - 1; i >= 0; i--) {
            let child = layer.children[i];
            if (!conditionFunc || conditionFunc(child)) {
                result.push(child);
                // break;
            }
        }
        return result;
    }
    /**
     * 从所有层中查找复合条件的元素
     * @param conditionFunc 条件函数
     */
    public findNodeFromTotalLayer(conditionFunc: (node: cc.Node) => boolean): cc.Node[] {
        let keys = this._totalLayer.keys;
        let result: cc.Node[] = [];
        for (let i = 0, len = keys.length; i < len; i++) {
            result = result.concat(this.findNodeFromLayer(keys[i], conditionFunc));
        }
        return result;
    }




    /**
     * 锁定场景
     */
    public lockSceneSwitch() {
        if (!this._isImmediateSwitchScene) {
            return;
        }
        this._isImmediateSwitchScene = false;
        //下一帧立即切换场景
        timer.addNextFrameListener(functionWrapper(this.unlockSceneSwitch, this));
    }
    public unlockSceneSwitch() {
        if (this._isImmediateSwitchScene) {
            return;
        }
        this._isImmediateSwitchScene = true;
        let stackLength = this._scenesStack.length;
        if (this._nextScene || stackLength > 0)// && this._runningScene != this._scenesStack[stackLength-1] )
        {//需要替换
            this._nextScene = this._scenesStack[stackLength - 1];
            this._setNextScene();
            for (let i = stackLength - 2; i >= 0; i--) {//在场景栈中但没有显示的场景，先缓存资源
                this._scenesStack[i].cacheScene();
            }
        }

    }

    /**
     * push一个新场景到场景栈中
     * @param scene 下一个场景
     */
    public pushScene(scene: SceneNodeLoader): void {
        this._nextScene = scene;
        if (this._isImmediateSwitchScene) {

            this._setNextScene();
        }
        else {
            this._nextScene = null;
            this._setNextScene();
            asset.useingScene(scene.sceneAssetName);
        }
        this._scenesStack.push(scene);
    }

    /**
     * pop场景
     * @param isImmediate 是否立即执行，否则下帧执行
     */
    public popScene(): void {
        if (this._scenesStack.length == 0)
            return;
        let currPopScene = this._scenesStack.pop();

        if (this._isImmediateSwitchScene) {
            var c = this._scenesStack.length;
            this._nextScene = c > 0 ? this._scenesStack[c - 1] : null;
            this._setNextScene();
        }
        else {//不立即替换场景

            this._nextScene = null;
            this._setNextScene();
        }

    }

    public runScene(scene: SceneNodeLoader): void {
        this.pushScene(scene);
    }

    public onEnable(): void {
        super.onEnable();
    }

    public showSceneSnapshot(node: cc.Node) {
        this.hideSceneSnapshot();
        this._currSceneSnapshot.active = true;
        node.scale = 1 / this.sceneScale;
        node.scaleY = -node.scaleY;
        this._currSceneSnapshot.addChild(node);
        this._currSceneSnapshot["__timeoutID"] = timer.setTimeout(functionWrapper(this.onLoadSceneTimeout, this), 60000);
    }

    protected onLoadSceneTimeout() {
        console.warn("load scene timeout:" + this._runningScene.sceneAssetName);

        this.hideSceneSnapshot();
        gameGlobal.$CurrOpenContext.backLastSceneContext(true);
    }
    protected hideSceneSnapshot() {
        if (!this._currSceneSnapshot.active) {
            return;
        }
        this._currSceneSnapshot.active = false;
        console.log("Scene delete scene snapshot");
        this._currSceneSnapshot.removeAllChildren(true);

        if (this._currSceneSnapshot["__timeoutID"] > 0) {
            timer.clearTimeout(this._currSceneSnapshot["__timeoutID"]);
            this._currSceneSnapshot["__timeoutID"] = -1;
        }
    }
    public saveSceneSnapshot() {
        console.log("Scene create scene snapshot");
        if (!this._runningScene) {
            return null;
        }
        this.hideSceneSnapshot();

        let snapshotNode = CommonUtils.CreateSpriteWithNodeSnapshot(this._contentLayer, true)

        let sprite = snapshotNode.getComponent(cc.Sprite)

        //屏幕截图时，为了防止截图的透明度被底图影响，修改混合参数
        sprite.srcBlendFactor = cc.macro.BlendFactor.ONE
        sprite.dstBlendFactor = cc.macro.BlendFactor.ZERO

        return snapshotNode;
    }

    public _setNextScene(): void {

        let oldScene = this._runningScene;
        this._runningScene = this._nextScene;
        let isTriggerDestroy = false;
        if (oldScene) {
            // let isRealseSceneAsset = oldScene && oldScene.autoReleaseAssets;
            if (this._scenesStack.indexOf(oldScene) >= 0) {//还在栈中 
                oldScene.removeFromParent(false);
                oldScene.onPushToStack();
            }
            else {//不在栈中，清理掉
                oldScene.onPopFromStack();
                oldScene.removeFromParent(true);
                oldScene.destroy();
                asset.unuseScene(oldScene.sceneAssetName);
                isTriggerDestroy = true;
            }
        }
        this.removeNodeFromTotalLayer(function (node: cc.Node): boolean {
            return !node["__isPersist__"];
        });
        //模拟正常的cc场景切换
        timer.addNextFrameListener(functionWrapper(function () {//下一帧清理垃圾
            cc.Object["_deferredDestroy"]();
        }, null));

        this._nextScene = null;
        if (this._runningScene) {
            if (this._scenesStack.indexOf(this._runningScene) < 0) {
                asset.useingScene(this._runningScene.sceneAssetName);
            }

            this._contentLayer.addChild(this._runningScene);
            this._runningScene.onBeginRunning();
            if (this._runningScene.isLoadComplete) {
                this.onSceneLoadComplete(this._runningScene, false);
            }
            else {
                this._runningScene.once(SceneNodeLoader.EVENT_LOAD_COMPLETE, this.onSceneLoadComplete, this);
            }
        }
    }

    protected onSceneLoadComplete(targetScene: SceneNodeLoader, isCheckGC: boolean = true) {
        this._sceneFrameAutoReleaseMap.set(targetScene.sceneAssetName, targetScene.autoReleaseAssets);
        if (targetScene == this._runningScene) {
            this.hideSceneSnapshot();

            if (isCheckGC) {
                if (this._gcDelayTimerID != -1)
                    timer.clearTimeout(this._gcDelayTimerID);
                this._gcDelayTimerID = timer.setTimeout(this.checkGC.bind(this), 500);
            }
        }
    }

    private checkGC() {
        if (this._isAsyncNodeLoading > 0 || asset.unuseSceneLength <= 1) {//当前没有异步加载
            return;
        }

        let isLoadComplete = true;
        for (let i = 0, len = this._scenesStack.length; i < len; i++) {
            if (!this._scenesStack[i].isLoadComplete) {
                isLoadComplete = false;
                break;
            }
        }
        if (isLoadComplete) {//当前栈中场景全部加载完毕
            let isRelease = false;
            let unuseSceneList = asset.getUnuseSceneList();
            for (let i = 0, len = unuseSceneList.length; i < len; i++) {
                let sceneName = unuseSceneList[i];
                if (this._sceneFrameAutoReleaseMap.get(sceneName)) {
                    isRelease = true;
                    break;
                }
            }
            if (isRelease) {
                asset.releaseUnuseAssets();
            }
        }
    }
}

registerClass("SceneFrame", SceneFrameA);