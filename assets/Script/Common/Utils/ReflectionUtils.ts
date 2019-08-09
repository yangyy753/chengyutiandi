/**
 * 注册一个类
 * @param {Function} constructor
 */
export function registerClass( className:string, constructor: Function)
{
    // cc.js.setClassName( constructor.prototype.constructor.name,constructor );
    cc.js.setClassName( className,constructor );
}

export function getClassDefineByName( className:string ):Function
{
    return cc.js.getClassByName( className );
}