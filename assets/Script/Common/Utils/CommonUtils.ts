import { gameGlobal } from "../../GameGlobal";

export default class CommonUtils {

    private static _nextID: number = 0;
    public static GetNextID(): number {
        return CommonUtils._nextID++;
    }

    //#region Random
    private static _seed: number = 0;

    private static seededRandom(): number {
        this._seed = (this._seed * 9301 + 49297) % 233280;
        return this._seed / 233280;
    };

    public static Random(min: number, max: number): number {
        min = (typeof min !== "undefined") ? min : 0;
        max = (typeof max !== "undefined") ? max : 1;
        return min + CommonUtils.seededRandom() * (max - min);
    }
    //#endregion

    //#region Type
    public static IsString(obj: any): boolean {
        return toString.call(obj) === '[object String]';
    }

    public static IsFunction(obj: any): boolean {
        return typeof obj === "function";
    }

    public static GetClassName(obj: any): string {
        if (!obj) {
            return null;
        }
        let property = Object.getPrototypeOf(obj);
        return property.constructor.name;
    }
    //#endregion

    /**
    * 创建某个节点的快照，并返回一个该快照的精灵节点
    * @param sourceNode 来源节点,为null则表示全屏快照
    * @param isExistMask 节点中是否存在遮罩
    */
    public static CreateSpriteWithNodeSnapshot(sourceNode: cc.Node = null, isExistMask?: boolean, scale: number = 1, targetSize: cc.Size = cc.Size.ZERO): cc.Node {
        let texture = this.CreateNodeSnapshot(sourceNode, isExistMask, scale, targetSize);
        let resultNode = new cc.Node();
        resultNode.setContentSize(cc.size(texture.width, texture.height));
        let spr = resultNode.addComponent<cc.Sprite>(cc.Sprite);
        spr.spriteFrame = new cc.SpriteFrame(texture);

        let oldonDestroy = spr["onDestroy"];
        spr["onDestroy"] = function () {
            if (oldonDestroy)
                oldonDestroy.call(this);
            texture.destroy();
        }.bind(spr);
        resultNode.scaleY = -1;
        return resultNode;
    }

    /**
    * 创建节点快照
    * @param sourceNode 来源节点,为null则表示全屏快照
    * @param isExistMask 节点中是否存在遮罩
    */
    public static CreateNodeSnapshot(sourceNode: cc.Node = null, isExistMask?: boolean, scale: number = 1, targetSize: cc.Size = cc.Size.ZERO): cc.RenderTexture {
        console.log("CreateNodeSnapshot-->begin");
        let targetNode = new cc.Node();
        cc.director.getScene().addChild(targetNode);
        if (!sourceNode) {
            sourceNode = gameGlobal.getRunningScene();
            if (isExistMask !== undefined)
                isExistMask = true;
        }

        let visibleSize = gameGlobal.$SceneFrame.validSceneWorldRect;
        let pos = cc.v2(0, 0);
        let left_bottom = sourceNode.convertToWorldSpace(pos)
        pos.x = sourceNode.width;
        pos.y = sourceNode.height;
        let right_top = sourceNode.convertToWorldSpace(pos)

        left_bottom.x = Math.max(left_bottom.x, 0);
        left_bottom.y = Math.max(left_bottom.y, 0);
        let worldWidth = Math.min(right_top.x - left_bottom.x, visibleSize.width);
        let worldHeight = Math.min(right_top.y - left_bottom.y, visibleSize.height);

        targetNode.x = (left_bottom.x + worldWidth * 0.5);
        targetNode.y = (left_bottom.y + worldHeight * 0.5);


        let textureSize = cc.Size.ZERO

        textureSize.width = Math.ceil(worldWidth * scale);
        textureSize.height = Math.ceil(worldHeight * scale);

        //如果有目标size，则根据目标size来进行处理
        if (targetSize.width != 0 || targetSize.height != 0) {
            let scaleWidth = 1
            if (targetSize.width != 0) {
                scaleWidth = targetSize.width / worldWidth;
            }

            let scaleHeight = 1
            if (targetSize.height != 0) {
                scaleHeight = targetSize.height / worldHeight;
            }

            scale = Math.min(scaleWidth, scaleHeight)

            if (targetSize.height != 0) {
                let scaleValue = targetSize.height / sourceNode.height;
                textureSize.width *= scaleValue;
                textureSize.height *= scaleValue;
            }
        }

        let camera = targetNode.addComponent<cc.Camera>(cc.Camera);
        camera.cullingMask = 0xffffffff;
        camera.zoomRatio = scale;

        let texture = new cc.RenderTexture();
        if (isExistMask) {
            let gl = cc.game._renderContext;
            texture.initWithSize(textureSize.width, textureSize.height, gl.STENCIL_INDEX8);
        }
        else {
            texture.initWithSize(textureSize.width, textureSize.height);
        }
        camera.targetTexture = texture;
        camera.render(sourceNode);
        texture.handleLoadedTexture();
        targetNode.removeFromParent(true);
        targetNode.destroy()
        return texture;
    }
}