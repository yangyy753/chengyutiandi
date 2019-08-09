export interface IPoolItem {
    /**
     * Recovery Start
     */
    reuse?(): void;
    /**
     * Frozen
     */
    unuse?(): void;
    /**
     * Destroyed
     */
    destory?(): void;
}