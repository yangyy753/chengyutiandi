import AbstractDialog from "../Common/Message/AbstractDialog";
import CommonUtils from "../Common/utils/CommonUtils";
import { functionWrapper } from "../Struct/FunctionWrapper";
import { msg } from "../Common/Message/MessageManager";
import { gameGlobal } from "../GameGlobal";
import { timer } from "../Common/Time/TimerManager";
import { Debug } from "../Common/Log/LogManager";
import VirtualScene from "./VirtualScene";

export class SceneNodeLoader extends cc.Node {
    public static EVENT_LOAD_COMPLETE = "EVENT_LOAD_COMPLETE";
    protected _scenePrefabName: string;
    protected _targetPrefabNode: cc.Node;
    protected _sceneComponent: VirtualScene;
    protected _openParams: any;
    protected _isTotalEnabled: boolean;
    protected _isRunning: boolean;
    protected _isInSceneStack: boolean;
    protected _loadTipsDialog: AbstractDialog;
    protected _InstanceID: number;
    constructor(prefabOrName: string | cc.Prefab) {
        super();
        this._InstanceID = CommonUtils.GetNextID();
        this._isInSceneStack = false;
        this._sceneComponent = null;
        this._loadTipsDialog = null;
        if (prefabOrName instanceof cc.Prefab) {
            this._scenePrefabName = prefabOrName["_uuid"];
            this.initWithScenePrefab(prefabOrName);
        }
        else {
            this._scenePrefabName = prefabOrName;
            this._targetPrefabNode = null;
        }


        this._isTotalEnabled = false;
        let widget = this.addComponent(cc.Widget);
        widget.alignMode = cc.Widget.AlignMode.ALWAYS;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        this._isRunning = false;
    }
    get instanceID() {
        return this._InstanceID;
    }
    get sceneAssetName() {
        return this._scenePrefabName;
    }

    set openParams(value: any) {
        this._openParams = value;
    }
    get isLoadComplete() {
        return this._targetPrefabNode != null;
    }

    protected onSceneLoadProgress() {
    }

    get autoReleaseAssets() {
        return this._sceneComponent && this._sceneComponent.autoReleaseAssets;
    }

    get isRunning() {
        return this._isRunning;
    }


    get sceneComponent() {
        return this._sceneComponent;
    }

    protected initWithScenePrefab(prefab: cc.Prefab) {
        console.log("Scene initWithScenePrefab,prefabName=" + this._scenePrefabName);
        this._targetPrefabNode = cc.instantiate(prefab);
        if (!this._targetPrefabNode) {
            console.log("Scene initWithScenePrefab fail," + this._scenePrefabName);
            return false;
        }

        let oldEmit: Function = this._targetPrefabNode.emit;
        let self = this;
        this._targetPrefabNode.emit = function () {
            oldEmit.apply(this, arguments);
            self.emit.apply(self, arguments);
        }

        let widget = this._targetPrefabNode.getComponent<cc.Widget>(cc.Widget);
        if (!widget) {
            widget = this._targetPrefabNode.addComponent(cc.Widget);
        }
        widget.top = widget.bottom = widget.left = widget.right = 0;
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        // widget.isAlignOnce = true;
        this._sceneComponent = this._targetPrefabNode.getComponent<VirtualScene>(VirtualScene);
        this._sceneComponent.setOpenParams.call(this._sceneComponent, this._openParams);
        if (this.parent) {
            this._targetPrefabNode.once(VirtualScene.EVENT_SCENE_ENABLED, this.onSceneEnabled, this);
            gameGlobal.pauseNotifyCenter("Enable_" + this._scenePrefabName, 1000, "wait ui enable:" + this._scenePrefabName);
        }
        gameGlobal.resumeNotifyCenter("Load_" + this._scenePrefabName);
        this.addChild(this._targetPrefabNode);
        return true;
    }



    protected onSceneLoadComplete(err: any, result: cc.Prefab) {
        if (!this._isInSceneStack) {

            return;
        }

        if (!this.isValid) {

            return;
        }
        console.log("Scene scene load complete,name=" + this._scenePrefabName);
        let targetPrefab = cc.loader.getRes(this._scenePrefabName);
        console.log("Scene加载完成:" + this._scenePrefabName, err, "result=" + (result != null), "targetPrefab=" + (targetPrefab != null));
        if (!targetPrefab) {//下载未成功
            if (this._isRunning) {//正在运行中
                this._loadTipsDialog = msg.Tips("正在加载...", 60000, null, "ResLoading_" + this._scenePrefabName, { isPersist: true });
            }
            console.log("Scenen load fail,reload begin..., isRunning=" + this._isRunning);
            cc.loader.loadRes(this._scenePrefabName, this.onSceneLoadProgress.bind(this), this.onSceneLoadComplete.bind(this));
            return;
        }

        if (!this.initWithScenePrefab(targetPrefab)) {//有可能会实例化组件失败，此时再次去尝试加载
            cc.loader.releaseRes(this._scenePrefabName);
            if (this._isRunning) {//正在运行中
                this._loadTipsDialog = msg.Tips("正在加载...", 60000, null, "ResLoading_" + this._scenePrefabName, { isPersist: true });
            }
            cc.loader.loadRes(this._scenePrefabName, this.onSceneLoadProgress.bind(this), this.onSceneLoadComplete.bind(this));
        }

    }

    protected onSceneEnabled() {
        console.log("Scene scene onSceneEnabled,name=" + this._scenePrefabName);
        if (this._loadTipsDialog) {
            gameGlobal.removePanelWithTag("ResLoading_" + this._scenePrefabName);
            this._loadTipsDialog = null;
        }
        this.emit(SceneNodeLoader.EVENT_LOAD_COMPLETE, this);
        gameGlobal.resumeNotifyCenter("Enable_" + this._scenePrefabName);
        this._isTotalEnabled = true;
    }
    get isTotalEnabled() {
        return this._isTotalEnabled;
    }

    public onBeginRunning() {//开始运行
        this._isRunning = true;
        this._isInSceneStack = true;
        console.log("Scene onBeginRunning,name=" + this._scenePrefabName + ",isExistPrefabNode:" + (this._targetPrefabNode != null));
        this.cacheScene();
    }

    public cacheScene() {
        if (!this._targetPrefabNode) {
            this._isTotalEnabled = false;

            if (this._isRunning)
                gameGlobal.pauseNotifyCenter("Load_" + this._scenePrefabName, 60000, "wait ui load:" + this._scenePrefabName);

            timer.setTimeout(functionWrapper(function () {
                if (!this._isInSceneStack || !this._isRunning || this._isTotalEnabled) {
                    return;
                }
                this._loadTipsDialog = msg.Tips("正在加载...", 60000, null, "ResLoading_" + this._scenePrefabName, { isPersist: true });
            }, this), 500);
            cc.loader.loadRes(this._scenePrefabName, this.onSceneLoadProgress.bind(this), this.onSceneLoadComplete.bind(this));
        }
    }

    public onPushToStack() {//被压入场景栈中
        console.log("Scene scene push to stack,name=" + this._scenePrefabName);
        this._isRunning = false;
        this._isInSceneStack = true;
        if (this._loadTipsDialog) {
            gameGlobal.removePanelWithTag("ResLoading_" + this._scenePrefabName);
            this._loadTipsDialog = null;
        }

        gameGlobal.resumeNotifyCenter("Enable_" + this._scenePrefabName);
        gameGlobal.resumeNotifyCenter("Load_" + this._scenePrefabName);
    }
    public onPopFromStack() {//被弹出场景栈
        console.log("Scene scene pop from stack,name=" + this._scenePrefabName);
        this._isRunning = false;
        this._isInSceneStack = false;
        if (this._loadTipsDialog) {
            gameGlobal.removePanelWithTag("ResLoading_" + this._scenePrefabName);
            this._loadTipsDialog = null;
        }
        gameGlobal.resumeNotifyCenter("Enable_" + this._scenePrefabName);
        gameGlobal.resumeNotifyCenter("Load_" + this._scenePrefabName);
    }

    public getSceneID(): number {
        if (this._sceneComponent) {
            return this._sceneComponent.getSceneID();
        } else {
            Debug.Warning("getSceneID 场景还未初始化完")
        }
        return 0
    }
}