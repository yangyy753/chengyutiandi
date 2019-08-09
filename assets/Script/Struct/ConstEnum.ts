/**
 * 系统内置通知类型
 */
export const enum GAME_SYSTEM_NOTIFYS
{
    /**
     * 游戏启动
     */
    GAME_ON_STARUP="GAME_ON_STARUP",
    /**
     * 游戏切到后台
     */
    GAME_ON_HIDE="GAME_ON_HIDE",
    /**
     * 游戏切到前台
     */
    GAME_ON_SHOW="GAME_ON_SHOW"
}

export const enum Env
{
    DEBUG="debug",
    RELEASE="release"
}