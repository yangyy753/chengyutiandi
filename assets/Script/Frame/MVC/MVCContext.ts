import { INotifyRouting } from "../../Common/Notify/NotifyCenter";
import Model from "./Model";
import Controller from "./Controller";
import View from "./View";
import { gameGlobal } from "../../GameGlobal";
import Notify from "../../Common/Notify/Notify";

export default class MVCContext implements INotifyRouting {
    protected _ModelList: Array<Model>;
    protected _ControllDict: { [key: string]: [{ new(): Controller }] };
    protected _ViewList: Array<View>;
    protected _ChildrenList: Array<MVCContext>;
    protected _ParentContextList: Array<MVCContext>;
    protected _UserData: any;
    protected _ContextName: string;
    protected _IsContextOpen: boolean;
    protected _Tag: string[];
    /**
     * 跳转来源节点
     */
    protected _jumpFromContextName: string;
    protected _fromOpenContextName: string;

    constructor(name: string, ...tag: string[]) {
        this._ContextName = name;
        this._ModelList = new Array<Model>();
        this._ControllDict = {};
        this._ViewList = new Array<View>();
        this._ChildrenList = new Array<MVCContext>();
        this._UserData = {};
        this._ParentContextList = new Array<MVCContext>();
        this._Tag = tag;
        this._jumpFromContextName = null;
        this._fromOpenContextName = null;
    };
    get name() {
        return this._ContextName;
    }

    set contextTags(tags: string[]) {
        this._Tag = tags;
    }
    public removeTag(tag: string): void {
        if (this._Tag && this._Tag.length) {
            let index = this._Tag.indexOf(tag)
            if (index >= 0) {
                this._Tag.splice(index, 1);
            }
        }
    }
    public addTag(tag: string): void {
        if (!this._Tag)
            this._Tag = [];
        let index = this._Tag.indexOf(tag)
        if (index < 0) {
            this._Tag.push(tag);
        }
    }
    public hasTag(tag: string): boolean {
        return this._Tag && this._Tag.indexOf(tag) >= 0;
    }


    protected onContextOpen(params?: any): void {

    }
    protected onContextClose(): void {

    }
    public initializationModel(models: Model[]): void {
        let self = this;
        this._ModelList = <Array<Model>>(models || []);
        let len = this._ModelList.length;
        for (var i = 0; i < len; i++) {
            this._ModelList[i].onAddToContext(self, self._getModel.bind(self));
        }
    };
    public initializationController(controllers: any[]): void {
        let self = this;
        let len = controllers ? controllers.length : 0;
        for (var i = 0; i < len; i++) {
            let controller = controllers[i][1];
            this._ControllDict[controllers[i][0]] = [controller];
            if (controller.prototype == undefined) {
                controller.onAddToContext(self, self._getView, self._getModel);
            }
        }
    }
    public initializationView(mediators: View[]): void {
        let self = this;
        this._ViewList = <Array<View>>(mediators || []);
        let len = this._ViewList.length;
        for (var i = 0; i < len; i++) {
            this._ViewList[i].onAddToContext(self, this._getView, this._getModel);
        }
    }
    get isOpen() {
        return this._IsContextOpen;
    }

    public open(): void {
        this._open();
    }
    public close(): void {
        this._close();
        let self = this;
        let len = this._ChildrenList.length;
        for (var i = 0; i < len; i++) {
            if (self._ChildrenList[i].isOpen) {
                self._ChildrenList[i].close();
            }
        }
    }

    /**
     * 尝试回退到来时的节点
     */
    public backToFromContext() {
        let isFind = false;
        if (this._jumpFromContextName) {//存在来时节点名字
            let parent = this.getOpenParent();

            while (parent) {
                if (parent.name == this._jumpFromContextName) {
                    isFind = true;
                    break;
                }
                parent = parent.getOpenParent();
            }

        }
        if (isFind) {
            this.close();
            let closeContextNames = [this.name];
            let parent = this.getOpenParent();
            gameGlobal.$CurrOpenContext = parent;
            while (parent) {
                if (parent.name == this._jumpFromContextName) {
                    break;
                }
                closeContextNames.push(parent.name);
                parent.close();
                parent = parent.getOpenParent();
                gameGlobal.$CurrOpenContext = parent;
            }
            console.log("关闭节点：", closeContextNames);
            if (gameGlobal.$CurrOpenContext)
                gameGlobal.$CurrOpenContext._activity();
        }
        else {
            this.backLastSceneContext();
        }

    }

    /**
     * 回退到上一个带UI场景的节点
     */
    public backLastSceneContext(isCheckLoadSuccess: boolean = false) {
        this.close();
        let closeContextNames = [this.name];
        let targetContext = this.getOpenParent();
        gameGlobal.$CurrOpenContext = targetContext;
        while (true) {
            if (!targetContext) {
                return;
            }
            let isFind = false;
            if (targetContext._ViewList && targetContext._ViewList.length > 0) {
                for (let i = 0, len = targetContext._ViewList.length; i < len; i++) {
                    let mediator: View = targetContext._ViewList[i];
                    if (mediator.isSceneView) {
                        if (isCheckLoadSuccess) {
                            if (mediator.isSceneViewAssetLoaded) {
                                isFind = true;
                                break;
                            }
                        }
                        else {
                            isFind = true;
                            break;
                        }
                    }
                }
            }
            if (isFind) {
                break;
            }
            closeContextNames.push(targetContext.name);
            targetContext.close();
            targetContext = targetContext.getOpenParent();
            gameGlobal.$CurrOpenContext = targetContext;
        }
        console.log("关闭节点：", closeContextNames);


    }

    /**
     * 获取打开的父级
     * @returns 
     */
    public getOpenParent(): MVCContext | null {

        if (this._fromOpenContextName) {
            for (let i = 0, len = this._ParentContextList.length; i < len; i++) {
                if (this._ParentContextList[i].isOpen && this._ParentContextList[i].name == this._fromOpenContextName) {
                    return this._ParentContextList[i];
                }
            }
        }
        for (let i = this._ParentContextList.length - 1; i >= 0; i--) {
            if (this._ParentContextList[i].isOpen) {
                return this._ParentContextList[i];
            }
        }
        return null;
    }
    /**
     * 获取带有某个tag的父级
     * @param tagList 
     * @returns
     */
    public getParentWithTag(tagList: string[]): MVCContext {
        for (let i = 0, len = this._ParentContextList.length; i < len; i++) {
            let parent = this._ParentContextList[i];

            if (parent._Tag && parent._Tag.length > 0) {

                let isFind = false;
                for (let j = 0; j < parent._Tag.length; j++) {
                    if (tagList.indexOf(parent._Tag[j]) >= 0) {
                        isFind = true;
                        break;
                    }
                }
                if (isFind) {
                    return parent;
                }

            }
        }
        return null;
    }
    /**
     * 获取全部带有指定tag的父级
     * @param tagList 
     * @returns
     */
    protected getParentsWithTag(tagList: string[]): MVCContext[] {
        let result: MVCContext[] = [];
        for (let i = 0, len = this._ParentContextList.length; i < len; i++) {
            let parent = this._ParentContextList[i];

            if (parent._Tag && parent._Tag.length > 0) {

                let isFind = false;
                for (let j = 0; j < parent._Tag.length; j++) {
                    if (tagList.indexOf(parent._Tag[j]) >= 0) {
                        isFind = true;
                        break;
                    }
                }
                if (isFind) {
                    result.push(parent);
                }
            }
        }
        return result;
    }
    /**
     * 获取父级数量
     */
    public getParentCount(): number {
        return this._ParentContextList.length;
    }
    public getRootContext(): MVCContext {
        let rootContext: MVCContext = this;
        while (rootContext.getParentCount() > 0) {
            rootContext = rootContext._ParentContextList[0];
        }
        return rootContext;
    }
    public getCurrentContext(): MVCContext | null {
        let rootContext = this.getRootContext();
        var findFunc: (root: MVCContext) => MVCContext = function (root) {
            if (root.isOpen) {
                let isFind = false;
                var len = root._ChildrenList.length;

                for (var i = 0; i < len; i++) {
                    if (root._ChildrenList[i].isOpen) {
                        isFind = true;
                        return findFunc(root._ChildrenList[i]);
                    }
                }
                return root;
            }
            else {
                return null;
            }
        };
        return findFunc(rootContext);
    }
    public findContext(name: string): MVCContext | null {
        let rootContext = this.getRootContext();
        var findFunc: (root: MVCContext, name: string) => MVCContext = function (root, name) {
            if (root.name == name) {
                return root;
            }
            let len = root._ChildrenList.length;
            for (var i = 0; i < len; i++) {
                let result = findFunc(root._ChildrenList[i], name);
                if (result) {
                    return result;
                }
            }
            return null;
        };
        return findFunc(rootContext, name);
    }

    public isChildContext(childContext: MVCContext) {
        let index = this._ChildrenList.indexOf(childContext);
        if (index >= 0) {
            return true;
        }

        for (let i = 0, len = this._ChildrenList.length; i < len; i++) {
            let result = this._ChildrenList[i].isChildContext(childContext);
            if (result) {
                return true;
            }
        }
        return false;
    }

    /**
     * 返回值表示是否切换成功。如果当前节点和切换节点一直就不会切换。
     * @param name 
     * @param params 
     * @param tagList 
     */
    public switchContext(name: string, params?: any, tagList?: string[]): boolean {
        console.log("[Lib] switchContext:", name, "tagList:", tagList);

        let closeList: MVCContext[] = [];
        let openList: MVCContext[] = [];

        let lastCurrentContext = this.getCurrentContext();
        let lastCurrentContextName: string = lastCurrentContext.name;

        let currContext = this.findContext(name);
        // if (lastCurrentContext == currContext)
        //     return;
        let beforeTags = [];
        if (lastCurrentContext) {
            let parent = lastCurrentContext;
            while (parent) {
                closeList.unshift(parent);
                if (parent._Tag && parent._Tag.length > 0)
                    beforeTags.push.apply(beforeTags, parent._Tag)
                parent = parent.getOpenParent();
            }
        }

        let currTagList = (currContext._Tag && currContext._Tag.length > 0) ? currContext._Tag.concat() : [];
        if (tagList && tagList.length > 0) {
            currTagList = currTagList.concat(tagList);
        }

        if (lastCurrentContext === currContext) {//目的节点一致
            let isContainer = true;
            for (let i = 0, len = currTagList.length; i < len; i++) {
                if (beforeTags.indexOf(currTagList[i]) < 0) {
                    isContainer = false;
                }
            }
            if (isContainer) {//当前打开路径上存在的tag全部包括了跳转的tag
                return true;
            }


        }


        let existTags = [];
        if (currContext) {
            let parent = currContext;
            while (parent) {
                openList.unshift(parent);
                // if( tagList && tagList.length > 0 )
                // {//必选tag存在

                // }
                // else 
                // {

                // }
                if (parent._Tag && parent._Tag.length > 0) {
                    existTags.push.apply(existTags, parent._Tag);
                }

                if (parent._ParentContextList.indexOf(lastCurrentContext) >= 0) {//回到了当前打开的节点
                    //校验是否所有的tag都已经满足
                    let isFullMatch = true;
                    if (tagList && tagList.length > 0) {


                        for (let i = 0, len = tagList.length; i < len; i++) {
                            let tmpTag = tagList[i];
                            if (existTags.indexOf(tmpTag) >= 0 || beforeTags.indexOf(tmpTag) >= 0) {
                                continue;
                            }
                            else {
                                isFullMatch = false;
                                break;
                            }
                        }
                    }
                    if (isFullMatch) {
                        for (let i = closeList.length - 1; i >= 0; i--) {
                            openList.unshift(closeList[i]);
                        }
                        break;
                    }
                }



                let tagParentList = (tagList && tagList.length > 0) ? parent.getParentsWithTag(tagList) : null;
                let currParent: MVCContext = null;
                if (tagParentList && tagParentList.length > 0) {
                    if (tagParentList.length > 1) {//有多个满足条件父级
                        if (tagParentList.indexOf(lastCurrentContext) >= 0) {//当前打开的节点存在
                            currParent = lastCurrentContext;
                        }
                        else {
                            //优先选择打开的父级
                            for (let i = tagParentList.length - 1; i >= 0; i--) {
                                if (tagParentList[i].isOpen) {
                                    currParent = tagParentList[i];
                                    break;
                                }
                            }
                            if (!currParent) {
                                //选择最短路径
                                currParent = tagParentList[0];
                            }
                        }
                    }
                    else {
                        currParent = tagParentList[0];
                    }
                }



                if (!currParent) {//没有找到符合Tag的父级
                    //是否有打开的父级
                    if (parent._ParentContextList.indexOf(lastCurrentContext) >= 0) {
                        currParent = lastCurrentContext;
                    }
                    else {
                        currParent = parent.getOpenParent();
                    }
                }
                if (!currParent) {//既没有符合tag的父级，也没有打开的父级。
                    if (parent.getParentCount() > 0) {
                        currParent = parent._ParentContextList[0];
                        if (parent._ParentContextList.length > 1) {
                            console.warn("[Lib] 多个父级都不存在指定Tag,tagList:,", currTagList, ",currName:", this.name);
                        }
                    }
                }
                parent = currParent;
            }
        }



        let sameCount = 0;
        for (var i = 0; i < Math.min(closeList.length, openList.length); i++) {
            if (closeList.length > i && openList.length > i && closeList[i] === openList[i]) {
                sameCount++;
            }
            else {
                break;
            }
        }
        if (closeList.length == openList.length && sameCount == openList.length)
            return false;

        {
            if (openList.indexOf(lastCurrentContext) < 0) {
                lastCurrentContextName = closeList[sameCount - 1].name;
            }
        }

        let isExistOpenScene = false;
        let openSceneReady = false;
        let closeViewCount = 0;
        let openViewCount = 0;
        let sceneSapshotNode: cc.Node = null;
        {
            for (var i = openList.length - 1; i >= sameCount; i--) {
                let openContext = openList[i];
                for (let j = 0; j < openContext._ViewList.length; j++) {
                    let openView = openContext._ViewList[j];
                    if (openView.isSceneView) {
                        openViewCount++;
                        if (!isExistOpenScene) {
                            isExistOpenScene = true;
                            openSceneReady = openView.isSceneViewAssetLoaded;
                        }
                    }
                }

            }
            if (isExistOpenScene) {
                sceneSapshotNode = gameGlobal.$SceneFrame.saveSceneSnapshot();
            }
        }

        for (var i = closeList.length - 1; i >= sameCount; i--) {
            let closeContext = closeList[i];
            for (let j = 0; j < closeContext._ViewList.length; j++) {
                let openView = closeContext._ViewList[j];
                if (openView.isSceneView) {
                    closeViewCount++;
                    break;
                }
            }
        }
        if ((openViewCount + closeViewCount) > 1)
            gameGlobal.$SceneFrame.lockSceneSwitch();

        let closeContextNames = [];
        for (var i = closeList.length - 1; i >= sameCount; i--) {
            let closeContext = closeList[i];
            closeContextNames.push(closeContext.name);
            closeContext._jumpFromContextName = null;
            closeContext._fromOpenContextName = null;

            gameGlobal.$CurrOpenContext = i > 0 ? closeList[i - 1] : null;
            closeContext._close();
        }
        console.log("关闭节点:", closeContextNames);
        if (openList.length > 0) {
            gameGlobal.$CurrOpenContext = openList[openList.length - 1];
            gameGlobal.$CurrOpenContext._jumpFromContextName = lastCurrentContextName;
        }
        else {
            gameGlobal.$CurrOpenContext = null;
        }

        let openContextNames = [];
        // let lastOpenContext:MVCContext = null;
        for (var i = sameCount; i < openList.length; i++) {
            let openContext = openList[i];
            openContextNames.push(openContext.name);
            openContext._fromOpenContextName = i > 0 ? openList[i - 1].name : null;
            if (openContext.name == name) {
                if (sceneSapshotNode)
                    gameGlobal.$SceneFrame.showSceneSnapshot(sceneSapshotNode);
                openContext._open(params);
            }
            else {
                openContext._jumpFromContextName = null;
                openContext._open();
                // openList[i]._open(params);
            }
            // lastOpenContext = openContext;
        }
        console.log("开启节点:", openContextNames);
        if ((openViewCount + closeViewCount) > 1)
            gameGlobal.$SceneFrame.unlockSceneSwitch();
        if (openList.length > 0) {
            gameGlobal.$CurrOpenContext._activity(params);
        }
        else {
            gameGlobal.$CurrOpenContext = null;
        }
        console.log("[Lib] switchContext complete,currContextName:", gameGlobal.$CurrOpenContext.name);
        return true;
    }
    protected _activity(...params: any[]): void {

        this.onContextActivity(params);

        let len = this._ModelList.length;
        for (var i = 0; i < len; i++) {
            this._ModelList[i].onContextActivity(params);
        }
        len = this._ViewList.length;
        for (var i = 0; i < len; i++) {
            this._ViewList[i].onContextActivity(params);
        }
    }
    //当该节点被设置成当前节点
    public onContextActivity(...params: any[]): void {

    }

    public setUserData(key: string, value: any): void {
        this._UserData[key] = value;
    }
    public getUserData(key: string): any | null {
        if (this._UserData[key]) {
            return this._UserData[key];
        }
        else {
            let openParent = this.getOpenParent();
            if (openParent) {
                return openParent.getUserData(key);
            }
            return null;
        }
    }
    public addContext(context: MVCContext): void {
        if (this._ChildrenList.indexOf(context) < 0) {
            this._ChildrenList.push(context);
            context._ParentContextList.push(this);
        }
    }
    public removeContext(context: MVCContext): void {
        let index = this._ChildrenList.indexOf(context);
        if (index != -1) {
            this._ChildrenList.splice(index, 1);
            index = context._ParentContextList.indexOf(this);
            if (index >= 0) {
                context._ParentContextList.splice(index, 1);
            }
        }
    }
    public addModel(model: Model): void {
        let index = this._ModelList.indexOf(model);
        if (index == -1) {
            this._ModelList.push(model);
            model.onAddToContext(this, this._getModel.bind(this));
        }
    }

    public findModelWithClassName(modelName: string): Model {
        let len = this._ModelList.length;
        for (var i = 0; i < len; i++) {
            let property = Object.getPrototypeOf(this._ModelList[i]);
            let className = property.constructor.name;
            if (className === modelName) {
                return this._ModelList[i];
            }
        }
        let openParent = this.getOpenParent();
        if (openParent) {
            return openParent.findModelWithClassName(modelName);
        }
        else {
            return null;
        }
    }
    public findModelWithModelName(name: string): Model {
        return this._getModel(name);
    }

    protected _getModel(name: string): Model | null {
        let len = this._ModelList.length;
        for (var i = 0; i < len; i++) {
            if (this._ModelList[i].name === name) {
                return this._ModelList[i];
            }
        }
        let openParent = this.getOpenParent();
        if (openParent) {
            return openParent._getModel(name);
        }
        else {
            return null;
        }
    }
    protected _getModelFromCurrContext(name: string): Model {
        let currContext = this.getCurrentContext();
        return currContext._getModel(name);
    }
    public removeModel(model: Model): void {
        let index = this._ModelList.indexOf(model);
        if (index != -1) {
            this._ModelList.splice(index, 1);
            model.onRemoveFromContext(this);
        }
    }
    /**
     * 注册controller
     * @param notifyType 通知类型
     * @param controller 通知处理Controller类构造
     */
    public registerController(notifyType: string | number, controller: { new(): Controller; }): void {
        if (this._ControllDict[notifyType]) {
            let index = this._ControllDict[notifyType].indexOf(controller);
            if (index == -1) {
                this._ControllDict[notifyType].push(controller);
            }
        }
        else {
            this._ControllDict[notifyType] = [controller];
        }
        // if (!Object.getPrototypeOf( controller ) )
        // {//传入是类实例
        //     controller.onAddToContext(this, this._getView, this._getModel);
        // }
    }
    public unregisterController(controller: { new(): Controller }): void {
        let isFind = false;
        let keys = Object.keys(this._ControllDict);
        for (var key in keys) {
            let index = this._ControllDict[key].indexOf(controller);
            if (index != -1) {
                this._ControllDict[key].splice(index, 1);
                isFind = true;
            }
        }
        // if (isFind) {
        //     if (!controller.prototype) {
        //         controller.onRemoveFromContext(this);
        //     }
        // }
    }
    public addView(mediator: View): void {
        let index = this._ViewList.indexOf(mediator);
        if (index == -1) {
            this._ViewList.push(mediator);
            mediator.onAddToContext(this, this._getView, this._getModel);
        }
    }
    protected _getView(name: string): View | null {
        let len = this._ViewList.length;
        for (var i = 0; i < len; i++) {
            if (this._ViewList[i].name === name) {
                return this._ViewList[i];
            }
        }
        let openParent = this.getOpenParent();
        if (openParent) {
            return openParent._getView(name);
        }
        else {
            return null;
        }
    }
    protected _getViewFromCurrContext(name: string): View | null {
        let currContext = this.getCurrentContext();
        return currContext._getView(name);
    }
    public removeView(mediator: View): void {
        let index = this._ViewList.indexOf(mediator);
        if (index != -1) {
            this._ViewList.splice(index, 1);
            mediator.onRemoveFromContext(this);
        }
    }

    public postNotify(ntfType: string, userData: any = null, isNextFramePost: boolean = true, queueName?: string): void {

        if (!this.isOpen) {
            return;
        }
        gameGlobal.$NotifyCenter.postNotify(ntfType, userData, isNextFramePost, queueName);
    }



    public postNotifyToQueue(ntfType: string, userData: any = null, isNextFramePost: boolean = true, queueName: string): void {
        if (!this.isOpen) {
            return;
        }
        gameGlobal.$NotifyCenter.postNotify(ntfType, userData, isNextFramePost, queueName);
    }
    public nextNotifyQueue(queueName): void {
        if (!this.isOpen) {
            return;
        }
        gameGlobal.$NotifyCenter.nextNotifyQueue(queueName);
    }
    public clearNotifyQueue(queueName): void {
        if (!this.isOpen) {
            return;
        }
        gameGlobal.$NotifyCenter.clearNotifyQueue(queueName);
    }
    public clearAllNotifyQueue(): void {
        if (!this.isOpen) {
            return;
        }
        gameGlobal.$NotifyCenter.clearAllNotifyQueue();
    }
    public registerNotifyQueue(queueName): void {
        if (!this.isOpen) {
            return;
        }
        gameGlobal.$NotifyCenter.registerNotifyQueue(queueName);
    }
    public getCurrNotifyFromQueue(queueName): Notify | null {
        if (!this.isOpen) {
            return null;
        }
        return gameGlobal.$NotifyCenter.getCurrNotifyFromQueue(queueName);
    }
    protected _executeNotify(notify: Notify): number {
        if (!this.isOpen) {
            return 0;
        }

        let obsCount = 0;
        if (this._ControllDict[notify.notifyType]) {
            let notifyList = this._ControllDict[notify.notifyType].slice();
            let notifyLen = notifyList.length;

            for (var i = 0; i < notifyLen; i++) {
                let controller = notifyList[i];
                let handler = new controller();
                handler.onAddToContext(this, this._getView, this._getModel);
                handler.executeNotify(notify);
                handler.onRemoveFromContext(this);
                obsCount++;
                if (notify.stopPropagetion)
                    return obsCount;
            }
        }
        let mediatorLen = this._ViewList.length;
        for (var i = 0; i < mediatorLen; i++) {
            let mediator = this._ViewList[i];
            if (mediator.hasNotifyObserver(notify.notifyType)) {
                mediator.handlerNotify(notify);
                obsCount++;
                if (notify.stopPropagetion)
                    return obsCount;
            }
        }
        if (!notify.stopPropagetion) {
            let openParent = this.getOpenParent();
            if (openParent)
                obsCount += openParent._executeNotify(notify);
        }
        if (obsCount == 0) {
            notify.setComplete();
        }

        return obsCount;
    }
    public executeNotify(notify: Notify): number {
        if (!gameGlobal.$CurrOpenContext) {
            return 0;
        }
        return gameGlobal.$CurrOpenContext._executeNotify(notify);
    }
    public _open(params?: Object) {
        if (this._IsContextOpen) {
            return;
        }
        this.onContextOpen(params);

        this._IsContextOpen = true;
        //BaseContext._CurrContext = this;
        let len = this._ModelList.length;
        for (var i = 0; i < len; i++) {
            let model = this._ModelList[i];
            // if( model.openParentCount > 0 )
            // {
            //     model.onContextActivity( params );
            // }
            // else 
            // {
            model.onContextOpen(params);
            // }
        }
        len = this._ViewList.length;
        for (var i = 0; i < len; i++) {
            this._ViewList[i].onContextOpen(params);
        }
    }
    public _close(): void {
        if (!this._IsContextOpen) {
            return;
        }
        let len = this._ModelList.length;
        for (var i = 0; i < len; i++) {
            let model = this._ModelList[i];
            model.onContextClose();
        }
        len = this._ViewList.length;
        for (var i = 0; i < len; i++) {
            this._ViewList[i].onContextClose();
        }
        this._IsContextOpen = false;
        this.onContextClose();
    }
    /**
     * 获取在打开的节点树是否存在某个tag
     * @param tag 
     */
    public static HasTagFromOpenContextList(tag: string): boolean {
        let rootContext = gameGlobal.$CurrOpenContext;

        let parent = rootContext;
        while (parent) {
            if (parent._Tag && parent._Tag.length > 0 && parent._Tag.indexOf(tag) >= 0) {
                return true;
            }
            parent = parent.getOpenParent();
        }
        return false;
    }
    public static IsOpen(contextName: string): boolean {
        let targetContext = gameGlobal.$CurrOpenContext.findContext(contextName);
        return targetContext && targetContext.isOpen;
    }
}
