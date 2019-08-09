import { gameGlobal } from "../GameGlobal";

var rectIntersects = function (rect1: cc.Rect, rect2: cc.Rect) {
    var maxax = rect1.x + rect1.width,
        maxay = rect1.y + rect1.height,
        maxbx = rect2.x + rect2.width,
        maxby = rect2.y + rect2.height;
    return !(maxax <= rect2.x || maxbx <= rect1.x || maxay <= rect2.y || maxby <= rect1.y);
};


const { ccclass, property, menu } = cc._decorator;
@ccclass
@menu("FDK/Common/ScreenVisibleListener")
export default class ScreenVisibleListener extends cc.Component {
    protected static TMP_POS = cc.v2();

    public static Event_Invisible = "Event_Invisible";
    public static Event_Visible = "Event_Visible";


    @property(cc.Boolean)
    public isEnablePosListener: boolean = false;


    //是否被其他UI覆盖
    protected mIsBeCovered: boolean;
    //是否进入屏幕
    protected mInScreen: boolean;

    //是否屏幕可见
    private mIsScreenVisible: boolean;


    private mMyWorldRect: cc.Rect;


    private mSceneWorldRect: cc.Rect;
    constructor() {
        super();
        this.mIsBeCovered = false;
        this.mInScreen = true;
        this.mMyWorldRect = cc.rect();
    }


    onLoad() {
        this.mIsScreenVisible = this.mInScreen = true;
    }

    //是否在屏幕上可见
    public isScreenVisible() {
        return this.mIsScreenVisible;
    }

    onEnable() {
        this.getMyWorldRect(this.mMyWorldRect);
        this.mSceneWorldRect = gameGlobal.$SceneFrame.validSceneWorldRect;
    }

    update() {
        if (!this.isEnablePosListener) {
            return;
        }
        this.getMyWorldRect(this.mMyWorldRect);
        if (rectIntersects(this.mSceneWorldRect, this.mMyWorldRect)) {
            this.mInScreen = true;
        }
        else {
            this.mInScreen = false;
        }
        this.checkVisible();
    }


    protected getMyWorldRect(result?: cc.Rect): cc.Rect {
        if (!result) {
            result = cc.rect();
        }
        ScreenVisibleListener.TMP_POS.x = ScreenVisibleListener.TMP_POS.y = 0;
        let pos = this.node.convertToWorldSpace(ScreenVisibleListener.TMP_POS);
        result.x = Math.round(pos.x);
        result.y = Math.round(pos.y);

        ScreenVisibleListener.TMP_POS.x = this.node.width;
        ScreenVisibleListener.TMP_POS.y = this.node.height;
        pos = this.node.convertToWorldSpace(ScreenVisibleListener.TMP_POS)
        result.width = pos.x - result.x;
        result.height = pos.y - result.y;
        return result;
    }

    set beConvered(value: boolean) {
        if (this.mIsBeCovered != value) {
            this.mIsBeCovered = value;
            this.checkVisible();
        }
    }

    private checkVisible() {
        if (this.mIsBeCovered || !this.mInScreen) {
            if (this.mIsScreenVisible) {
                this.mIsScreenVisible = false;
                this.onScreenInvisible();
            }
        }
        else {
            if (!this.mIsScreenVisible) {
                this.mIsScreenVisible = true;
                this.onScreenVisible();
            }
        }
    }



    public onScreenInvisible() {
        //屏幕不可见
        this.node.emit(ScreenVisibleListener.Event_Invisible);
    }
    public onScreenVisible() {
        //屏幕可见
        this.node.emit(ScreenVisibleListener.Event_Visible);
    }


}