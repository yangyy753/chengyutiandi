import { PlatformSDK, PlatformSysSettingKeys } from "../SDK/PlatformSDK";
import { I18n } from "../GameGlobal";

/**
 * canvas绘制节点
 */
export class GraphicsNode {
    /**
     * 坐标
     */
    _Position: { x: number, y: number };
    /**
     * 旋转
     */
    _Rotate: number;
    /**
     * 缩放
     */
    _Scale: { x: number, y: number };
    /**
     * 是否可见
     */
    _Visible: boolean;
    /**
     * 父容器
     */
    _Parent: GraphicsContainer;


    _IsDirty: boolean;


    _AnchorPosition: { x: number, y: number };
    constructor() {
        this._Scale = { x: 1, y: 1 };
        this._Position = { x: 0, y: 0 };
        this._Rotate = 0;
        this._AnchorPosition = { x: 0.5, y: 0.5 };
        this._Visible = true;
        this._IsDirty = false;

    }
    destory() {

    }
    setAnchor(anchorX: number, anchorY: number) {
        if (this._AnchorPosition.x != anchorX || this._AnchorPosition.y != anchorY) {
            this._AnchorPosition.x = anchorX;
            this._AnchorPosition.y = anchorY;
            this.setDirty();
        }
    }
    setVisible(visible: boolean) {
        if (this._Visible != visible) {
            this._Visible = visible;
            this.setDirty();
        }
    }
    get isValid() {
        return true;
    }
    isVisible() {
        return this._Visible;
    }
    setPosition(x: number, y: number) {
        x = Math.round(x);
        y = Math.round(y);
        if (this._Position.x == x && this._Position.y == y)
            return;
        this._Position.x = x;
        this._Position.y = y;
        this.setDirty();
    }
    /**
     *
     * @return {{x: number, y: number}}
     */
    getPosition() {
        return { x: this._Position.x, y: this._Position.y };
    }
    setRotate(rotate: number) {
        if (this._Rotate == rotate)
            return;
        this._Rotate = rotate;
        this.setDirty();
    }
    getRotate() {
        return this._Rotate;
    }
    setScale(sx: number, sy: number) {
        if (this._Scale.x == sx && this._Scale.y == sy)
            return;
        this._Scale.x = sx;
        this._Scale.y = sy;
        this.setDirty();
    }
    setDirty() {
        this._IsDirty = true;
        if (this._Parent) {
            this._Parent.setDirty();
        }
    }

    removeFromParent() {
        if (this._Parent) {
            this._Parent.removeChild(this);
            this._Parent = null;
        }
    }
    /**
     *
     * @return {GraphicsContainer}
     */
    getParent() {
        return this._Parent;
    }
    /**
     * 更新变形转换
     * @param contentSize
     */
    upddateTransforms(graphics: any, contentSize: { width: number, height: number }) {
        graphics["translate"](this._Position.x, this._Position.y);
        if (this._Rotate) {
            graphics["rotate"]((Math.PI / 180) * this._Rotate);
        }
        if (this._Scale.x != 1 || this._Scale.y != 1) {
            graphics["scale"](this._Scale.x, this._Scale.y);
        }
    }
    /**
     * 绘制到画布上
     * @param graphics
     * @return {boolean} 是否绘制成功，对于某些节点可能需要等待资源加载完成后才能绘制
     */
    draw(graphics: any, isForce: boolean) {
        this._IsDirty = false;
        return true;
    }
    isDirty() {
        return this._IsDirty;
    }
}

/**
 * canvas形状节点
 */
export class GraphicsShape extends GraphicsNode {







}

/**
 * canvas绘制容器
 */
export class GraphicsContainer extends GraphicsNode {


    /**
     * @member {Array.<GraphicsNode>}
     */
    _Children: GraphicsNode[];
    _ContentCanvas: any;
    _RenderingContext: any;
    /**
     * 容器尺寸
     */
    _CanvasSize: { width: number, height: number };
    _CurrDirtyIndex: number;
    /**
     * 填充颜色
     */
    _FillColor: { r: number, g: number, b: number };
    // _DrawCompleteListener:()=>void;
    //填充背景图片，容器的尺寸将保持和背景图片大小一致
    _fillImage: string;
    _fillBgSprite: GraphicsSprite;

    constructor(targetCanvas: any = null, presetSize = { width: 200, height: 200 }) {
        super();
        this._AnchorPosition.x = 0;
        this._AnchorPosition.y = 0;
        this._Children = [];
        this._CanvasSize = { width: presetSize.width, height: presetSize.height };
        this._ContentCanvas = targetCanvas || document.createElement('canvas');
        this._ContentCanvas["width"] = this._CanvasSize.width;
        this._ContentCanvas["height"] = this._CanvasSize.height;
        this._RenderingContext = this._ContentCanvas["getContext"]('2d');
        this._CurrDirtyIndex = 0;

    }
    destory() {
        // this.removeAllChildren(true);
        while (this._Children.length > 0) {
            let child = this._Children.pop();
            child._Parent = null;
            child.destory();
        }
        this._fillBgSprite = null;
        this._CurrDirtyIndex = 0;
        this._ContentCanvas["width"] = this._ContentCanvas["height"] = 0;
        this._ContentCanvas = null;
        this._RenderingContext = null;

        this.setDirty();
        // this.removeAllChildren(true);
    }
    /**
     *
     * @param {{r:number,g:number,r:number} | null} color
     */
    setFillColor(color: { r: number, g: number, b: number }) {
        if (this._FillColor != color) {
            this._FillColor = color;
            this._CurrDirtyIndex = 0;
            this.setDirty();
        }
    }
    setFillImage(url: string) {
        if (url) {
            if (!this._fillBgSprite) {
                this._fillBgSprite = new GraphicsSprite();
                this.addChild(this._fillBgSprite, 0);

            }
            this._fillBgSprite.setURL(url);
        }
        else {
            if (this._fillBgSprite) {
                this.removeChild(this._fillBgSprite);
            }
        }
    }
    getCanvas() {
        return this._ContentCanvas;
    }
    setSize(size: { width: number, height: number }) {
        if (this._CanvasSize.width != size.width || this._CanvasSize.height != size.height) {
            this._CanvasSize.width = size.width;
            this._CanvasSize.height = size.height;
            this._ContentCanvas["width"] = size.width;
            this._ContentCanvas["height"] = size.height;

            this._CurrDirtyIndex = 0;
            this.setDirty();
        }
    }

    setDirty() {
        let oldDirty = this._IsDirty;
        super.setDirty();
        // if( !this._Parent && !oldDirty)
        // {
        //     requestAnimationFrame( this.draw.bind(this) );
        // }
    }

    /**
     *
     * @param {GraphicsNode} child
     * @param {number | null} index
     */
    addChild(child: GraphicsNode, index?: number) {
        if (!child || this._Children.indexOf(child) >= 0)
            return;
        if (child._Parent) {
            child.removeFromParent();
        }
        index = arguments.length >= 2 ? arguments[1] : this._Children.length;

        let minIndex = (this._fillBgSprite && this._fillBgSprite._Parent) ? 1 : 0;
        if (index < minIndex) {
            index = minIndex;
            this._Children.splice(index, 0, child);
        }
        else if (index >= this._Children.length) {
            index = this._Children.length;
            this._Children.push(child);
        }
        else {
            this._Children.splice(index, 0, child);
        }
        child._Parent = this;
        this._CurrDirtyIndex = Math.min(this._CurrDirtyIndex, index);
        this.setDirty();
    }
    removeChild(child: GraphicsNode) {
        if (!child)
            return;
        let index = this._Children.indexOf(child);
        if (index < 0)
            return;
        this._Children.splice(index, 1);
        child._Parent = null;
        this._CurrDirtyIndex = Math.min(this._CurrDirtyIndex, index);
        this.setDirty();
    }
    removeAllChildren(isClear: boolean = true) {
        let minIndex = this._fillBgSprite ? 1 : 0;
        while (this._Children.length > minIndex) {
            let child = this._Children.pop();
            child._Parent = null;
            if (isClear) {
                child.destory();
            }
        }
        this._CurrDirtyIndex = 0;
        this.setDirty();
    }

    get isValid() {
        let result = true;
        for (let i = 0, len = this._Children.length; i < len; i++) {
            if (!this._Children[i].isValid) {
                result = false;
                break;
            }
        }
        return result;
    }

    draw(graphics: any, isForce: boolean = false) {
        // if( this._Parent && !graphics)
        // {
        //     let parent = this._Parent;
        //     while( parent._Parent )
        //     {
        //         parent = parent._Parent;
        //     }
        //     if( !parent._IsDirty )
        //     {
        //         parent.setDirty();
        //     }

        //     return;
        // }
        if (!this.isVisible())
            return true;
        if (this._FillColor) {
            this._RenderingContext["fillStyle"] = "rgb( " + this._FillColor.r.toString() + "," + this._FillColor.g.toString() + "," + this._FillColor.b.toString() + ")";
            this._RenderingContext["fillRect"](0, 0, this._CanvasSize.width, this._CanvasSize.height);
        }
        else {
            this._RenderingContext["clearRect"](0, 0, this._CanvasSize.width, this._CanvasSize.height);
        }

        let isReady = true;

        if (this._fillBgSprite && this._fillBgSprite.isValid) {
            if (this._CanvasSize.width != this._fillBgSprite.imageWidth || this._CanvasSize.height != this._fillBgSprite.imageHeight) {
                this.setSize({ width: this._fillBgSprite.imageWidth, height: this._fillBgSprite.imageHeight });
            }
            this._fillBgSprite.setPosition(this._CanvasSize.width * 0.5, this._CanvasSize.height * 0.5);
        }

        for (let i = 0, len = this._Children.length; i < len; i++) {
            let child = this._Children[i];
            if (!child.isVisible())
                continue;
            if (!child.isValid) {
                isReady = false;
                if (isForce) {
                    continue;
                }
                else {
                    break;
                }

            }
            this._RenderingContext["save"]();
            child.draw(this._RenderingContext, isForce);
            this._RenderingContext["restore"]();
            child._IsDirty = false;
            // if(!drawResult )
            // {
            //     this._CurrDirtyIndex = i;
            //     isReady = false;
            //     break;
            // }
        }

        if (isReady || isForce) {
            this._CurrDirtyIndex = this._Children.length;
            if (graphics) {
                graphics["save"]();
                this.upddateTransforms(graphics, { width: this._CanvasSize.width, height: this._CanvasSize.height });
                graphics["drawImage"](this._ContentCanvas, Math.floor(-this._AnchorPosition.x * this._CanvasSize.width), Math.floor(-this._AnchorPosition.y * this._CanvasSize.height));
                graphics["restore"]();
            }

            this._IsDirty = !isReady;
        }
        else {//有子元素没有准备就绪

        }

        return isReady;
    }

    toDataURL() {
        return this._ContentCanvas["toDataURL"]();
    }
    toTempFilePath(success, fail) {
        this._ContentCanvas["toTempFilePath"]({
            "success": success,
            "fail": fail
        })
    }
}


/**
 * canvas精灵节点
 */
export class GraphicsSprite extends GraphicsNode {

    /**
     * @member {String} 图片地址
     */
    _ImageURL: String;

    _realLoadURL: string;
    _ContentImage: any;
    _SrcRect: { x: number, y: number, width: number, height: number };
    /**
     * 是否加载完成
     */
    _IsLoadComplete: boolean;
    /**
     * 是否加载成功
     */
    _IsLoadSuccess: boolean;

    /**
     * 基础旋转属性
     */
    _BaseRotate: number;

    protected _presetSize: { width: number, height: number };

    constructor() {
        super();
        this._BaseRotate = 1;
    }
    get isValid() {
        return this._IsLoadComplete;// && this._IsLoadSuccess;
    }
    destory() {
        if (this._ContentImage) {
            this._ContentImage["src"] = '';
            this._ContentImage = null;
        }
    }
    /**
     * 添加图片地址，可以是本地或网络地址
     * @param {String} url
     */
    setURL(url: string) {
        // console.log( "GraphicsSprite.setURL:" + url );
        if (this._ImageURL == url) {
            return null;
        }
        this._ImageURL = url;
        this.setDirty();
        if (this._ImageURL && this._ImageURL.length > 0) {
            this._ContentImage = new Image();

            if (this._ContentImage.setAttribute) {
                this._ContentImage.setAttribute('crossOrigin', 'anonymous');
            }


            this._IsLoadComplete = false;
            this._IsLoadSuccess = false;
            this._ContentImage["onload"] = this._onImageLoadComplete.bind(this);
            this._ContentImage["onerror"] = this._onImageLoadFailure.bind(this);


            //新增，如果是share开头的图片，则需要去找最新版本的share图片
            // let shareIndex = url.indexOf("share/")
            // if(shareIndex>=0){

            //     let fileName =  url.slice(shareIndex+"share/".length)
            //     url = fdk.$AssetManager.getExternalAssetPath("share",fileName)
            // }


            //如果已经有http前缀或者wxfile前缀的图片，则直接使用url
            if (url.slice(0, "http".length) == "http" || url.slice(0, "data:image".length) == "data:image" || url.slice(0, "wxfile".length) == "wxfile") {
                this._realLoadURL = url;
            }
            else if (PlatformSDK.instance.isFileSync(url)) {
                this._realLoadURL = cc.path.join(PlatformSDK.instance.getUserRootPath(), url);
            }
            else {
                this._realLoadURL = cc.path.join(PlatformSDK.instance.settingData[PlatformSysSettingKeys.CDN], url);
            }
            this._ContentImage["src"] = this._realLoadURL;
            // this._ContentImage["src"] = this._ImageURL;
        }
        else {
            this._ContentImage = null;
            //this.setDirty();
        }
    }

    setImage(img) {
        this._ImageURL = null;
        if (this._ContentImage) {
            this._ContentImage["src"] = '';
            this._ContentImage = null;
        }
        this._ContentImage = img;
        this._IsLoadComplete = true;
        this._IsLoadSuccess = true;
        this.setDirty();
    }
    get imageWidth() {
        return this._ContentImage ? this._ContentImage["width"] : 0;
    }
    get imageHeight() {
        return this._ContentImage ? this._ContentImage["height"] : 0;
    }

    /**
     * 设置源图像区域
     */
    setSrcRect(srcRect: { x: number, y: number, width: number, height: number }) {
        if (srcRect) {
            if (this._SrcRect) {
                if (this._SrcRect.x != srcRect.x || this._SrcRect.y != srcRect.y || this._SrcRect.width != srcRect.width || this._SrcRect.height != srcRect.height) {
                    this._SrcRect.x = srcRect.x;
                    this._SrcRect.y = srcRect.y;
                    this._SrcRect.width = srcRect.width;
                    this._SrcRect.height = srcRect.height;
                    this.setDirty();
                }
            }
            else {
                this._SrcRect = { x: srcRect.x, y: srcRect.y, width: srcRect.width, height: srcRect.height };
                this.setDirty();
            }
        }
        else {
            if (this._SrcRect) {
                this._SrcRect = null;
                this.setDirty();
            }
        }
    }




    draw(graphics, isForce: boolean = false) {
        if (!this._ContentImage)
            return true;
        if (this._IsLoadComplete) {
            if (!this._IsLoadSuccess) {
                return true;
            }

        }
        else {
            return false;
        }

        let sx = 0, sy = 0;
        let sWidth = this._ContentImage["width"];
        let sHeight = this._ContentImage["height"];
        let dWidth = sWidth;
        let dHeight = sHeight;
        if (this._SrcRect) {
            sx = this._SrcRect.x;
            sy = this._SrcRect.y;
            dWidth = sWidth = this._SrcRect.width;
            dHeight = sHeight = this._SrcRect.height;
        }
        this.upddateTransforms(graphics, { width: dWidth, height: dHeight });
        graphics["drawImage"](this._ContentImage, sx, sy, sWidth, sHeight, Math.floor(-this._AnchorPosition.x * dWidth), Math.floor(-this._AnchorPosition.y * dHeight), dWidth, dHeight);
        return true;
    }
    /**
     *
     * @param {cc.SpriteFrame} frame
     */
    setSpriteFrame(image: any, srcRect: { x: number, y: number, width: number, height: number }, isRotated: boolean) {
        if (this._ContentImage) {
            this._ContentImage["src"] = '';
            this._ContentImage = null;
        }
        this._ContentImage = image;
        this.setSrcRect(srcRect);
        let oldRotate = this.getRotate();
        if (isRotated) {
            this._BaseRotate = -90;
        }
        else {
            this._BaseRotate = 0;
        }
        this.setRotate(oldRotate);
        this._IsLoadSuccess = this._IsLoadComplete = true;
        this.setDirty();
    }
    setRotate(rotate: number) {
        super.setRotate(this._BaseRotate + rotate);
    }
    getRotate() {
        return this._Rotate - this._BaseRotate;
    }

    _onImageLoadComplete() {
        if (this._ContentImage && this._ContentImage["src"] == this._realLoadURL) {
            if (this._presetSize) {
                this.updatePresize();
            }

            this._IsLoadComplete = true;
            this._IsLoadSuccess = true;

            this.setDirty();
        }
    }
    _onImageLoadFailure() {
        if (this._ContentImage && this._ContentImage["src"] == this._realLoadURL) {
            this._IsLoadComplete = true;
            this._IsLoadSuccess = false;
            this.setDirty();
        }
    }

    public setPresetSize(size: { width: number, height: number }) {
        this._presetSize = size;
        this.updatePresize();
    }
    protected updatePresize() {
        if (this._presetSize) {
            if (this._ContentImage && this._ContentImage["width"] > 0 && this._ContentImage["height"]) {
                let sx = this._presetSize.width / this._ContentImage["width"];
                let sy = this._presetSize.height / this._ContentImage["height"];
                let scale = Math.min(sx, sy);

                this.setScale(scale, scale);
            }

        }

    }
}

/**
 * canvas文本节点
 */
export class GraphicsLabel extends GraphicsNode {

    _TextDirection: string;
    _TextAlign: string;
    _FontSize: number = 24;
    _FontName: string;

    _TextColor: { r: number, g: number, b: number };

    _ContentText: string;
    /**
     * 最大宽度，超过该宽度会裁剪字符串，添加..后缀
     */
    _MaxWidth: number;
    constructor() {
        super();
    }
    setFont(fontSize: number, fontName: string) {
        if (this._FontSize != fontSize || this._FontName != fontName) {
            this._FontSize = fontSize;
            this._FontName = fontName;
            this.setDirty();
        }
    }
    /**
     *
     * 最大宽度，会适配该宽度裁切文字，并添加..后缀
     * @param {number} maxWidth
     */
    setMaxWidth(maxWidth: number) {
        if (this._MaxWidth != maxWidth) {
            this._MaxWidth = maxWidth;
            this.setDirty();
        }
    }
    /**
     *
     * @param {String} align  对齐方式：left | right | center | start| end
     */
    setTextAlign(align: string) {
        if (this._TextAlign != align) {
            this._TextAlign = align;
            this.setDirty();
        }
    }
    /**
     *
     * @param {String} direction  文本方向：ltr | rtl | inherit
     */
    setTextDirection(direction: string) {
        if (this._TextDirection != direction) {
            this._TextDirection = direction;
            this.setDirty();
        }
    }
    /**
     *
     * @param {String} text  文本
     */
    setText(text: string) {
        text = I18n.getTextWithIndexReg(text);
        if (this._ContentText != text) {
            this._ContentText = text;
            this.setDirty();
        }
    }
    /**
     *
     * @param {{r:number,g:number,b:number}} color
     */
    setTextColor(color: { r: number, g: number, b: number }) {
        if (color) {
            if (this._TextColor) {
                if (this._TextColor.r != color.r || this._TextColor.g != color.g || this._TextColor.b != color.b) {
                    this._TextColor.r = color.r;
                    this._TextColor.g = color.g;
                    this._TextColor.b = color.b;
                    this.setDirty();
                }
            }
            else {
                this._TextColor = { r: color.r, g: color.g, b: color.b };
                this.setDirty()
            }
        }
        else {
            if (this._TextColor) {
                this._TextColor = null;
                this.setDirty();
            }
        }
    }
    draw(graphics, isForce: boolean) {


        if (this._TextColor) {
            graphics["fillStyle"] = "rgb( " + this._TextColor.r.toString() + "," + this._TextColor.g.toString() + "," + this._TextColor.b.toString() + ")";
        }
        let fontName = this._FontSize.toString() + "px ";
        if (this._FontName && this._FontName.length > 0) {
            fontName += this._FontName;
        }
        else {
            fontName += "serif";
        }
        graphics["font"] = fontName;
        if (this._TextAlign && this._TextAlign.length > 0) {
            graphics["textAlign"] = this._TextAlign;
        }
        if (this._TextDirection && this._TextDirection.length > 0) {
            graphics["direction "] = this._TextDirection;
        }
        graphics["textBaseline "] = "middle";
        let textWidth = graphics["measureText"](this._ContentText)["width"];
        let finialText = this._ContentText;
        if (this._MaxWidth) {
            while (textWidth > this._MaxWidth) {
                finialText = finialText.substr(0, finialText.length - 1);
                textWidth = graphics["measureText"](finialText + "..")["width"];
            }
        }

        if (finialText.length != this._ContentText.length) {
            finialText += "..";
        }
        this.upddateTransforms(graphics, { width: textWidth, height: this._FontSize });
        graphics.fillText(finialText, Math.floor(-this._AnchorPosition.x * textWidth), Math.floor(this._AnchorPosition.y * this._FontSize));
        return true;
    }
}
/**
 * canvas数字标签节点
 */
export class GraphicsAtlasLabel extends GraphicsContainer {

    /**
     * 起始字符
     * @member {String}
     */
    _StartChar: string;


    /**
     * 字符尺寸
     * @member {{width:number,height:number} | null}
     */
    _ItemSize: { width: number, height: number };

    _ContentText: string;
    /**
     * @member {number} 字符间距
     */
    _CharSpace: number;
    _ContentImage: any;
    _IsLoadComplete: boolean;
    _IsLoadSuccess: boolean;
    _TextAlign: string;
    _ImageURL: string;
    _realLoadURL: string;

    constructor() {
        super();

        this._ItemSize = { width: 0, height: 0 };
        this._StartChar = '0';
        this._TextAlign = "left";

    }

    destory() {
        if (this._ContentImage) {
            this._ContentImage["src"] = '';
            this._ContentImage = null;
        }
    }

    setFont(charMapFile: string, itemWidth: number, itemHeight: number, startChar: string) {
        this._ImageURL = charMapFile;
        this._StartChar = startChar;
        this._ItemSize.width = itemWidth;
        this._ItemSize.height = itemHeight;
        if (this._ContentImage) {
            this._ContentImage["src"] = '';
            this._ContentImage = null;
        }
        this._ContentImage = new Image();
        this._ContentImage["onload"] = this._onImageLoadComplete.bind(this);
        this._ContentImage["onerror"] = this._onImageLoadFailure.bind(this);
        this._IsLoadComplete = false;
        this._IsLoadSuccess = false;
        if (PlatformSDK.instance.isFile(charMapFile)) {
            this._realLoadURL = cc.path.join(PlatformSDK.instance.getUserRootPath(), charMapFile);
        }
        else {
            this._realLoadURL = cc.path.join(PlatformSDK.instance.settingData[PlatformSysSettingKeys.CDN], charMapFile);
        }
        this._ContentImage["src"] = this._realLoadURL;


    }
    get isValid() {
        return this._IsLoadComplete && this._IsLoadSuccess;
    }
    setText(text: string) {


        if (this._ContentText != text) {
            this._ContentText = text;

            this._updateText();

            this.setDirty();
        }
    }

    _updateText() {
        if (this._IsLoadComplete && this._IsLoadSuccess) {
            return;
        }
        let totalWidth = this._ContentText.length * this._ItemSize.width + (this._ContentText.length - 1) * this._CharSpace;
        this.setSize({ width: totalWidth, height: this._ItemSize.height });
        let beginCode = this._StartChar.charCodeAt(0);

        let currX = this._ItemSize.width * 0.5;
        for (let i = 0, len = this._ContentText.length; i < len; ++i) {
            let ch = this._ContentText.charCodeAt(i);
            let index = ch - beginCode;
            let child = null;
            if (i < this._Children.length) {
                child = this._Children[i];
            }
            else {
                child = new GraphicsSprite();
                this._Children.push(child);
            }
            child.setSpriteFrame(this._ContentImage, { x: index * this._ItemSize.width, y: 0, width: this._ItemSize.width, height: this._ItemSize.height }, false)
            child.setPosition(currX, this._ItemSize.height * 0.5);
            currX += this._ItemSize.width + this._CharSpace;
        }

        while (this._Children.length > this._ContentText.length) {
            this.removeChild(this._Children[this._Children.length - 1]);
        }
    }
    setCharSpace(space: number) {
        if (this._CharSpace != space) {
            this._CharSpace = space;
            this._updateText();
            this.setDirty();
        }
    }
    _onImageLoadComplete() {
        if (this._ContentImage && this._ContentImage["src"] == this._realLoadURL) {
            this._IsLoadComplete = true;
            this._IsLoadSuccess = true;
            this._updateText();
            this.setDirty();
        }
    }
    _onImageLoadFailure() {
        if (this._ContentImage && this._ContentImage["src"] == this._realLoadURL) {
            this._IsLoadComplete = true;
            this._IsLoadSuccess = false;
            this.setDirty();
        }
    }
    draw(graphics, isForce: boolean = false) {
        if (!this._ContentImage)
            return true;
        if (this._IsLoadComplete) {
            if (!this._IsLoadSuccess) {
                return true;
            }
        }
        else {
            return false;
        }
        return GraphicsContainer.prototype.draw.call(this, graphics, isForce);
    }
}