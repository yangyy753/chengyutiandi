import Dictionary from "./Struct/Dictionary";
import { PlatformSDK } from "./SDK/PlatformSDK";
import SceneFrame, { GUILevels } from "./Frame/SceneFrame";
import Panel from "./Frame/Panel";
import { SceneNodeLoader } from "./Frame/SceneNodeLoader";
import MVCContext from "./Frame/MVC/MVCContext";
import NotifyCenter from "./Common/Notify/NotifyCenter";
import RootContext from "./RootContext";
import { GAME_SYSTEM_NOTIFYS } from "./Struct/ConstEnum";
import Notify from "./Common/Notify/Notify";
import { sound } from "./Sound/SoundManager";
import Model from "./Frame/MVC/Model";
import { Debug } from "./Common/Log/LogManager";
import { timer } from "./Common/Time/TimerManager";
import { getClassDefineByName } from "./Common/Utils/ReflectionUtils";
import { pool } from "./Common/Pool/PoolManager";
import { cache } from "./Common/Pool/CachePool";
import I18N from "./I18N";
import { store } from "./Common/Storage/LocalStorageManager";
import { asset } from "./AssetBundle/AssetManager";

class GameGlobal {
    private static _instance: GameGlobal = null;

    static instance(): GameGlobal {
        if (!this._instance)
            this._instance = new GameGlobal();
        return this._instance;
    }

    private _GlobalDataManager: Dictionary;
    private _RootContext: RootContext;
    private _CurrentOpenContext: MVCContext;
    private _NotifyCenter: NotifyCenter<MVCContext>;

    private _i18N: I18N;

    private _sceneFrame: SceneFrame;
    protected _frameBeginTime: number;

    constructor() {
        this._i18N = new I18N();
    }

    /**
     * 在ui根节点上添加一个ui事件监听，在捕获期触发。
     * 主要是用来捕获深层嵌套节点抛出的冒泡事件
     * @param {string} evt
     * @param {(evt: Event) => void} listener
     * @param thisObj
     */
    public addUIEvent(evt: string, listener: (evt: cc.Event) => void, thisObj: any): void {
        this._sceneFrame.node.on(evt, listener, thisObj, true);
    }
    public removeUIEvent(evt: string, listener: (evt: cc.Event) => void, thisObj: any): void {
        this._sceneFrame.node.off(evt, listener, thisObj, true);
    }

    public get currFrameBeginTime() {
        return this._frameBeginTime;
    }

    private onGameInited(evt: cc.Event): void {
        this._GlobalDataManager = new Dictionary();
        this._i18N.init();

        pool.init();
        timer.init();
        store.init();
        asset.init();
        cache.init();
        sound.init();

        cc.director.getScheduler().enableForTarget(timer);
        cc.director.getScheduler().scheduleUpdate(timer, 0, false);

        if (cc.director.getScene()) {
            this.initSceneFrame();
        }
        else {
            cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, this.onFirstSceneLanuch, this);
        }
    }

    get i18n() {
        return this._i18N;
    }

    private onFirstSceneLanuch(evt: cc.Event): void {
        cc.director.off(cc.Director.EVENT_AFTER_SCENE_LAUNCH, this.onFirstSceneLanuch, this);
        this.initSceneFrame();
    }

    protected initSceneFrame() {
        if (cc.director.getScene()) {
            let canvasNode = cc.director.getScene().getChildByName('Canvas');
            this._sceneFrame = canvasNode.addComponent(SceneFrame);
            this.onAfterDrawEvent();
        }
    }

    protected onAfterDrawEvent() {
        console.log("场景第一次绘制完成")

        PlatformSDK.instance.initSDK();
        pool.registerPool("cc.Event.EventCustom", cc.Event.EventCustom);
        let starUpClass: any = getClassDefineByName("AppStarupController");
        this._RootContext = new RootContext();
        this._NotifyCenter = new NotifyCenter<MVCContext>(this._RootContext);
        this._RootContext.registerController(GAME_SYSTEM_NOTIFYS.GAME_ON_STARUP, starUpClass);
        this._RootContext.open();
        this.$CurrOpenContext = this._RootContext;
        this._RootContext.postNotify(GAME_SYSTEM_NOTIFYS.GAME_ON_STARUP, null, false);
        this._RootContext.postNotify(GAME_SYSTEM_NOTIFYS.GAME_ON_SHOW);
        cc.game.on(cc.game.EVENT_SHOW, this.onGameShow, this);
        cc.game.on(cc.game.EVENT_HIDE, this.onGameHide, this);
    }

    private onDirectorBeforeUpdate() {
        this._frameBeginTime = cc.sys.now();
    }

    private onGameShow(evt: cc.Event): void {
        if (this._RootContext) {
            this._RootContext.postNotify(GAME_SYSTEM_NOTIFYS.GAME_ON_SHOW);
        }

        //在切到前后后更新一遍网络状态
        PlatformSDK.instance.updateCurrNetworkStatus(null);
        sound.stopAllEffect();
        if (AppDefines.CURR_ENV != "public") {
            for (let key in cc.loader["_cache"]) {
                let asset = cc.loader["_cache"][key];
                if (asset instanceof cc.Texture2D) {
                    if (!asset.loaded || !asset.isValid) {//该纹理已经失效
                        Debug.Warning("texture is unvalid:" + key);
                    }
                }
            }
        }
    }

    private onGameHide(evt: cc.Event): void {
        if (this._RootContext)
            this._RootContext.postNotify(GAME_SYSTEM_NOTIFYS.GAME_ON_HIDE);
        sound.stopAllEffect();
    }

    get $RootContext() {
        return this._RootContext;
    }

    /**
     * 
     * @param {string} name
     * @return {Model}
     */
    public getModel<T extends Model>(name: string): T {
        if (this._CurrentOpenContext) {
            return <T>this._CurrentOpenContext.findModelWithModelName(name);
        }
        return null
    }

    public setGlobalData(key: string | number, value: any): void {
        this._GlobalDataManager.set(key, value);
    }
    public getGlobalData(key: string | number): any {
        return this._GlobalDataManager.get(key);
    }
    public hasGlobalData(key: string | number): boolean {
        return this._GlobalDataManager.has(key);
    }
    public deleteGlobalData(key: string | number) {
        this._GlobalDataManager.delete(key);
    }

    //#region SceneFrame
    get $SceneFrame() {
        return this._sceneFrame;
    }
    public getRunningScene(): SceneNodeLoader {
        return this._sceneFrame.runningScene;
    }
    public registerDefaultAskPanel(panel: cc.Prefab): void {
        this._sceneFrame.registerDefaultAskPanel(panel);
    }
    public registerDefaultConfirmPanel(panel: cc.Prefab): void {
        this._sceneFrame.registerDefaultConfirmPanel(panel);
    }
    public registerDefaultCancelPanel(panel: cc.Prefab): void {
        this._sceneFrame.registerDefaultCancelPanel(panel);
    }
    public registerDefaultMessagePanel(panel: cc.Prefab): void {
        this._sceneFrame.registerDefaultMessagePanel(panel);
    }
    public registerDefaultWaitMessagePanel(panel: cc.Prefab): void {
        this._sceneFrame.registerDefaultWaitMessagePanel(panel);
    }

    /**
     * 同步显示一个节点
     * @param {cc.Node | string} node
     * @param {GUILevels} levels
     * @param {boolean} isPersist
     */
    public showNodeTo(node: cc.Node | string, levels: GUILevels = GUILevels.ForeGround, isPersist: boolean = false, queueName: string = null) {
        return this._sceneFrame.showNodeTo(node, levels, isPersist, queueName);
    }

    /**
     * 异步显示一个节点
     * @param {cc.Node | string} prefabPath 资源路径
     * @param {GUILevels} levels       显示层级
     * @param {boolean} isPersist       是否常驻
     */
    public showNodeToAsync(prefabPath: string, callFunc: (node: cc.Node) => void, levels: GUILevels = GUILevels.ForeGround, isPersist: boolean = false, queueName: string = null): void {
        this._sceneFrame.showNodeToAsync(prefabPath, callFunc, levels, isPersist, queueName);
    }

    public showPrefabTo(prefab: cc.Prefab | string, level: GUILevels, isPersist: boolean = false, queueName: string = null): cc.Node {
        return this._sceneFrame.showPrefabTo(prefab, level, isPersist, queueName);
    }

    public findPanelComponents<T extends Panel>(panelName: string | number, componentClass: { prototype: T }): T[] {
        return this._sceneFrame.findPanelComponent<T>(panelName, componentClass);
    }

    public findPanels(panelName: string | number): cc.Node[] {
        return this._sceneFrame.findPanel(panelName);
    }

    public findPanelComponent<T extends cc.Component>(panelName: string | number, componentClass: { prototype: T }): T {
        let panelList = this._sceneFrame.findPanelComponent<T>(panelName, componentClass);
        if (panelList && panelList.length > 0) {
            return panelList[0];
        }
        return null;
    }

    public findPanel(panelName: string | number): cc.Node {
        let panelList = this._sceneFrame.findPanel(panelName);
        if (panelList && panelList.length > 0) {
            return panelList[0];
        }
        return null;
    }

    public findPanelWithID(panelID: number): Panel[] {
        return this._sceneFrame.findPanelWithID(panelID)
    }

    public removePanelWithTag(tag: string | number): number {
        return this._sceneFrame.removePanelWithTag(tag);
    }

    public removePanelFromLayer(panelTag: string, guiLayer: GUILevels): number {
        return this._sceneFrame.removePanelFromLayer(panelTag, guiLayer);
    }

    public clearPanelFromLayer(guiLayer: GUILevels): void {
        this._sceneFrame.clearPanelFromLayer(guiLayer);
    }

    public removeTotalPanel(): void {
        this._sceneFrame.removeTotalPanel();
    }

    public removeNodeFromLayer(layerLevel: GUILevels, conditionFunc: (node: cc.Node) => boolean): number {
        return this._sceneFrame.removeNodeFromLayer(layerLevel, conditionFunc);
    }

    public removeNodeFromTotalLayer(conditionFunc: (node: cc.Node) => boolean): number {
        return this._sceneFrame.removeNodeFromTotalLayer(conditionFunc);
    }

    public pushScene(scene: SceneNodeLoader): void {
        this._sceneFrame.pushScene(scene);
    }

    public popScene(): void {
        this._sceneFrame.popScene();
    }

    /**
     * 获取界面的真实size大小
     */
    public getRealSceneSize() {
        return this._sceneFrame.sceneSize
    }
    //#endregion

    //#region Notify
    get $NotifyCenter() {
        return this._NotifyCenter;
    }
    get $CurrOpenContext() {
        return this._CurrentOpenContext;
    }
    set $CurrOpenContext(value: MVCContext) {
        this._CurrentOpenContext = value;
    }
    public findContext(contextName: string): MVCContext {
        return this.$CurrOpenContext.findContext(contextName);
    }
    返回列表中第一个找到的tag
    public hasTagFromOpenContextList(tagList: string[]): string {
        let rootContext = this.$CurrOpenContext;
        let parent = rootContext;
        while (parent) {
            for (let i = 0, len = tagList.length; i < len; i++) {
                let tag = tagList[i];
                if (parent.hasTag(tag)) {
                    return tag;
                }
            }
            parent = parent.getOpenParent();
        }
        return null;
    }
    public isContextOpen(context: string): boolean {
        let targetContext = this.findContext(context);
        return targetContext && targetContext.isOpen;
    }

    public pauseNotifyCenter(key: string, time: number = 0, reason?: string) {
        if (this._NotifyCenter)
            this._NotifyCenter.pause(key, time);
    }
    public resumeNotifyCenter(key: string) {
        if (this._NotifyCenter)
            this._NotifyCenter.resume(key);
    }
    public postNotify(ntfType: string, userData?: any, isNextFramePost?: boolean, queueName?: string): void {
        this._NotifyCenter.postNotify(ntfType, userData, isNextFramePost, queueName);
    }

    public addNotifyListener(ntfType: string, handler: (notify: Notify) => void, handlerThis: any): void {
        this._RootContext.addNotifyListener(ntfType, handler, handlerThis);
    }
    public removeNotifyListener(ntfType: string, handler: (notify: Notify) => void, handlerThis: any): void {
        this._RootContext.removeNotifyListener(ntfType, handler, handlerThis);

    }
    public clearNotifyQueue(queueName: string) {
        this._NotifyCenter.clearNotifyQueue(queueName);
    }
    public registerNotifyQueue(queueName: string) {
        this._NotifyCenter.registerNotifyQueue(queueName);
    }
    //#endregion
}

export var gameGlobal = GameGlobal.instance();
window["gameGlobal"] = gameGlobal;
export var I18n = gameGlobal.i18n; 
window["I18n"] = I18n;

if (!CC_EDITOR) {
    setTimeout(function () {
        cc.game.once(cc.game.EVENT_ENGINE_INITED, gameGlobal["onGameInited"], gameGlobal);
    })
}