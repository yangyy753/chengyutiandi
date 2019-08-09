export interface ICollectionDelegate {
    /**
     * 数据源被重置
     */
    onCollectionReset(oldSource: Array<any>, targetCollection: ArrayCollection);
    /**
     * 数据源经过排序或者其他操作，导致顺序变化
     */
    onCollectionRefesh(targetCollection: ArrayCollection);

    /**
     * 某个元素被添加
     * @param {number} index
     * @param item
     */
    onCollectionAdd(index: number, item: any, targetCollection: ArrayCollection);

    /**
     * 某个元素被更新
     * @param {number} index
     * @param newItem
     */
    onCollectionUpdate(index: number, newItem: any, targetCollection: ArrayCollection);

    /**
     * 某个元素被移除
     * @param {number} index
     * @param {any[]} item
     */
    onCollectionRemove(index: number, item: any[], targetCollection: ArrayCollection);
    /**
     * 某个元素被替换
     * @param {number} index
     * @param oldItem
     * @param newItem
     */
    onCollectionReplace(index: number, oldItem: any, newItem: any, targetCollection: ArrayCollection);
    /**
     * 数据源被清空
     */
    onCollectionClear(items: any[], targetCollection: ArrayCollection): void;
    /**
     * 数据源
     */
    onCollectionUpdateStatusSwitch(isUpdateing: boolean, targetCollection: ArrayCollection): void;
}
/**
 * ArrayCollection 类是数组的集合类数据结构包装器，可使用<code>ICollection</code>接口的方法和属性对其进行访问和处理。
 * 使用这种数据结构包装普通数组，能在数据源发生改变的时候主动通知视图刷新变更数据项。
 * @defaultProperty source
 */
export default class ArrayCollection extends cc.EventTarget implements ICollection {
    //需要刷新
    public static EVENT_NEED_REFRESH = "EVENT_NEED_REFRESH";
    /**
     * 时间监听列表
     */
    _ListenerList: ICollectionDelegate[];

    public refreshHandler: (arr: ArrayCollection) => boolean;

    protected _name: string | number;
    /**
     * 构造函数。<p/>
     * 用指定的原始数组创建一个 ArrayCollection 实例。
     */
    public constructor(source?: any[]) {
        super();
        this._ListenerList = [];
        if (source) {
            this._source = source;
        }
        else {
            this._source = [];
        }
    }

    set name(value: string | number) {
        this._name = value;
    }
    get name() {
        return this._name;
    }

    public needRefresh() {
        if (this.refreshHandler) {
            if (this.refreshHandler(this)) {
                this.setIsUpdateing(true);
                return true;
            }
            else {
                this.setIsUpdateing(false);
                return false;
            }
        }
        else {
            return false;
        }
        // this.emit( ArrayCollection.EVENT_NEED_REFRESH );
    }



    /**
     * @private
     */
    private _source: any[];
    /**
     * 数据源
     * 通常情况下请不要直接调用Array的方法操作数据源，否则对应的视图无法收到数据改变的通知。通常都是通过ICollection的接口方法来查看数据。
     * 若对数据源进行了修改，请手动调用refresh()方法刷新数据。
     */
    public get source(): any[] {
        return this._source;
    }

    public set source(value: any[]) {
        if (!value)
            value = [];
        let oldSource = this._source;
        this._source = value;
        this.dispatchCoEvent("onCollectionReset", oldSource);
    }

    public addListener(listener: ICollectionDelegate): void {
        if (listener && this._ListenerList.indexOf(listener) < 0) {
            this._ListenerList.push(listener);
            listener.onCollectionReset(null, this);
            if (this.length == 0) {
                this.needRefresh();
            }
        }
    }
    public removeListener(listener: ICollectionDelegate): void {
        let index = listener ? this._ListenerList.indexOf(listener) : -1;
        if (index >= 0) {
            this._ListenerList.splice(index, 1);
        }
    }
    public removeAllListener(): void {
        this._ListenerList.length = 0;
    }


    /**
     * 在对数据源进行排序或过滤操作后可以手动调用此方法刷新所有数据,以更新视图。
     * ArrayCollection 不会自动检原始数据进行了改变,所以你必须调用<code>refresh()</code>方法去更新显示。
     */
    public refresh(): void {
        this.dispatchCoEvent("onCollectionRefesh");
    }

    //--------------------------------------------------------------------------
    //
    // ICollection接口实现方法
    //
    //--------------------------------------------------------------------------

    /**
     * @inheritDoc
     */
    public get length(): number {
        return this._source.length;
    }
    /**
     * 向列表末尾添加指定项目。等效于 <code>addItemAt(item, length)</code>。
     * @param item 要被添加的项。
     */
    public addItem(item: any): void {
        this._source.push(item);
        this.dispatchCoEvent("onCollectionAdd", this._source.length - 1, item);
    }
    /**
     * 在指定的索引处添加项目。
     * 任何大于已添加项目的索引的项目索引都会增加 1。
     * 如果指定的索引比0小或者比最大长度要大。则会抛出1007异常。
     * @param item 要添加的项
     * @param index 要添加的指定索引位置
     */
    public addItemAt(item: any, index: number): void {
        if (index < 0 || index > this._source.length) {
            return;
        }
        this._source.splice(index, 0, item);
        this.dispatchCoEvent("onCollectionAdd", index, item);
    }
    public push(item: any): void {
        this.addItemAt(item, this.length);
    }
    public unshift(item): void {
        this.addItemAt(item, 0);
    }
    /**
     * @inheritDoc
     */
    public getItemAt(index: number): any {
        return this._source[index];
    }
    public front() {
        return this._source.length > 0 ? this._source[0] : null;
    }
    public last() {
        return this._source.length > 0 ? this._source[this._source.length - 1] : null;
    }
    public getItemWith(conditionFunc: (item: any) => boolean): any | null {
        let length: number = this._source.length;
        let result: any = null;
        for (let i: number = 0; i < length; i++) {
            let item = this._source[i];
            if (conditionFunc(item)) {
                result = item;
                break;
            }
        }
        return result;
    }
    public getItemsWith(conditionFunc: (item: any) => boolean): any[] {
        let length: number = this._source.length;
        let result: any[] = [];
        for (let i: number = 0; i < length; i++) {
            let item = this._source[i];
            if (conditionFunc(item)) {
                result.push(item);
                break;
            }
        }
        return result;
    }

    /**
     * @inheritDoc
     */
    public getItemIndex(item: any): number {
        let length: number = this._source.length;
        for (let i: number = 0; i < length; i++) {
            if (this._source[i] === item) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 获取某个元素的index
     * @param {(item: any) => boolean} conditionFunc 条件函数，返回true标识终止循环
     * @return {number}
     */
    public getItemIndexWith(conditionFunc: (item: any) => boolean) {
        let length: number = this._source.length;
        let result: number = -1;
        for (let i: number = 0; i < length; i++) {
            let item = this._source[i];
            if (conditionFunc(item)) {
                result = i;
                break;
            }
        }
        return result;
    }

    /**
     * 通知视图，某个项目的属性已更新。
     * @param item 视图中需要被更新的项。
     */
    public itemUpdated(item: any): void {
        let index: number = this.getItemIndex(item);
        if (index != -1) {
            this.dispatchCoEvent("onCollectionUpdate", index, item);
        }
    }


    /**
     * 删除列表中的所有项目。
     */
    public removeAll(): void {
        let items: any[] = this._source.concat();
        this._source = [];
        this.dispatchCoEvent("onCollectionClear", items);
    }


    /**
     * 删除指定索引处的项目并返回该项目。原先位于此索引之后的所有项目的索引现在都向前移动一个位置。
     * @param index 要被移除的项的索引。
     * @return 被移除的项。
     */
    public removeItemAt(index: number): any {
        if (index < 0 || index >= this._source.length) {
            return;
        }
        let item: any = this._source.splice(index, 1)[0];
        this.dispatchCoEvent("onCollectionRemove", index, item);
        return item;
    }

    public removeAllItemWith(conditionFunc: (index: number, item: any) => boolean) {
        let length: number = this._source.length;
        let indexList = [];
        for (let i: number = 0; i < length; i++) {
            let item = this._source[i];
            if (conditionFunc(i, item)) {
                indexList.push(i);
            }
        }
        let result = {};
        for (let i = indexList.length - 1; i >= 0; i--) {
            let index = indexList[i];
            let item = this.removeItemAt(index);
            result[index] = item;

        }
        return result;
    }
    public removeItemWith(conditionFunc: (index: number, item: any) => boolean) {
        let length: number = this._source.length;
        let result = null;
        for (let i: number = 0; i < length; i++) {
            let item = this._source[i];
            if (conditionFunc(i, item)) {
                result = item;
                this._source.splice(i, 1);
                this.dispatchCoEvent("onCollectionRemove", i, item);
                break;
            }
        }
        return result;
    }



    public pop(): void {
        return this.removeItemAt(this._source.length - 1);
    }
    public shift(): any {
        return this.removeItemAt(0);
    }

    /**
     * 替换在指定索引处的项目，并返回该项目。
     * @param item 要在指定索引放置的新的项。
     * @param index 要被替换的项的索引位置。
     * @return 被替换的项目，如果没有该项则返回<code>null</code> 。
     */
    public replaceItemAt(item: any, index: number): any {
        if (index < 0 || index >= this._source.length) {
            return;
        }
        let oldItem: any = this._source.splice(index, 1, item)[0];
        this.dispatchCoEvent("onCollectionReplace", index, oldItem, item);
        return oldItem;
    }

    /**
     * 用新数据源替换原始数据源，此方法与直接设置source不同，它不会导致目标视图重置滚动位置。
     * @param newSource 新数据。
     */
    public replaceAll(newSource: any[]): void {
        if (!newSource)
            newSource = [];
        let newLength = newSource.length;
        let oldLength = this._source.length;
        for (let i = newLength; i < oldLength; i++) {
            this.removeItemAt(newLength);
        }
        for (let i = 0; i < newLength; i++) {
            if (i >= oldLength)
                this.addItemAt(newSource[i], i);
            else
                this.replaceItemAt(newSource[i], i);
        }
        this._source = newSource;
    }


    public setIsUpdateing(value: boolean) {
        this.dispatchCoEvent("onCollectionUpdateStatusSwitch", value);
    }

    /**
     * @private
     * 抛出事件
     */
    private dispatchCoEvent(func: string, ...params: any[]): void {

        let currParams = (params && params.length > 0) ? params.concat() : [];
        currParams.push(this);
        for (let i = 0, len = this._ListenerList.length; i < len; i++) {
            this._ListenerList[i][func].apply(this._ListenerList[i], currParams);
        }
    }

    /**
     * 循环调用，当func返回true，则中断循环
     * @param {(item: any, index: number) => boolean} func
     */
    public each(func: (item: any, index: number) => boolean): void {
        let length: number = this._source.length;
        for (let i: number = 0; i < length; i++) {
            let item = this._source[i];
            if (func(item, i)) {
                break;
            }
        }
    }

    public swap(index1: number, index2: number): void {
        if (index1 >= 0 && index1 < this.length && index2 >= 0 && index2 < this.length && index1 != index2) {
            let item1 = this._source[index1];
            let item2 = this._source[index2];
            this.replaceItemAt(item1, index2);
            this.replaceItemAt(item2, index1);
        }
    }
}