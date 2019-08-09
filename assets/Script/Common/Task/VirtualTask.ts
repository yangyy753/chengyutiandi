import CommonUtils from "../utils/CommonUtils";
import FunctionWrapper, { functionWrapper } from "../../Struct/FunctionWrapper";
import { timer } from "../Time/TimerManager";

export const enum TaskStatus {
    WAIT = 0,
    DOING = 1,
    PAUSE = 2,
    COMPLETE = 3
}

export default class VirtualTask {

    public static RunningTaskList: VirtualTask[];
    protected _currStatus: TaskStatus;
    protected _taskID: number;

    protected _onCompleteHandle: FunctionWrapper<(task: VirtualTask) => void>;
    protected _onSuccessHandle: FunctionWrapper<(task: VirtualTask) => void>;
    protected _onFailHandle: FunctionWrapper<(task: VirtualTask) => void>;

    protected _currTimeoutID: number;

    protected _childrenList: VirtualTask[];

    protected _parentTask: VirtualTask;

    protected _taskName: string;

    constructor(name: string) {
        this._taskName = name;
        this._currStatus = TaskStatus.WAIT;
        this._currTimeoutID = -1;
        this._childrenList = [];
    }

    get taskName() {
        return this._taskName;
    }
    get runningID() {
        return this._taskID;
    }
    get taskState() {
        return this._currStatus;
    }

    public addChildTask(task: VirtualTask) {
        let index = this._childrenList.indexOf(task);
        if (index >= 0) {
            return;
        }
        this._childrenList.push(task);
        task._parentTask = this;
    }

    public removeChildTask(task: VirtualTask) {
        let index = this._childrenList.indexOf(task);
        if (index >= 0) {
            task._parentTask = null;
            this._childrenList.splice(index, 1);

        }
    }
    protected onChildTaskSuccess(task: VirtualTask) {

    }
    protected onChildTaskFail(task: VirtualTask) {

    }
    protected onChildTaskComplete(task: VirtualTask) {

    }




    get isComplete() {
        let result: boolean = true;
        for (let i = 0, len = this._childrenList.length; i < len; i++) {
            result = this._childrenList[i].isComplete;
            if (!result) {
                break;
            }
        }
        if (result && this._currStatus == TaskStatus.COMPLETE) {
            return true;
        }
        return result;
    }

    public setTaskTimeout(time: number) {
        this.cancelTaskTimeout();
        this._currTimeoutID = timer.setTimeout(functionWrapper(this.onTaskTimeout, this), time);
    }

    public cancelTaskTimeout() {
        if (this._currTimeoutID != -1) {
            timer.clearTimeout(this._currTimeoutID);
            this._currTimeoutID = -1;
        }
    }

    protected onTaskTimeout() {
        this._currTimeoutID = -1;
        this.onTaskFail();
    }

    public begin(success?: FunctionWrapper<(task: VirtualTask) => void>, fail?: FunctionWrapper<(task: VirtualTask) => void>, complete?: FunctionWrapper<(task: VirtualTask) => void>): number {
        this._onSuccessHandle = success;
        this._onFailHandle = fail;
        this._onCompleteHandle = complete;
        this._currStatus = TaskStatus.DOING;
        if (!VirtualTask.RunningTaskList) {
            VirtualTask.RunningTaskList = [];
        }
        VirtualTask.RunningTaskList.push(this);
        this._taskID = CommonUtils.GetNextID();
        this.onBegin();
        return this._taskID;
    }

    protected pause() {
        if (this._currStatus == TaskStatus.DOING) {
            this._currStatus = TaskStatus.PAUSE;
            for (let i = 0, len = this._childrenList.length; i < len; i++) {
                this._childrenList[i].pause();
            }
            this.onPause();
        }

    }

    protected resume() {
        if (this._currStatus == TaskStatus.PAUSE) {
            this._currStatus = TaskStatus.DOING;
            for (let i = 0, len = this._childrenList.length; i < len; i++) {
                this._childrenList[i].resume();
            }
            this.onResume();
        }
    }

    public stop() {
        if (this._currStatus != TaskStatus.COMPLETE && this._currStatus != TaskStatus.WAIT) {
            this._currStatus = TaskStatus.WAIT;
            let index = VirtualTask.RunningTaskList.indexOf(this);
            if (index >= 0) {
                VirtualTask.RunningTaskList.splice(index, 1);
            }

            for (let i = 0, len = this._childrenList.length; i < len; i++) {
                this._childrenList[i].stop();
            }


            this.onStoped();
        }
    }

    protected onTaskComplete() {
        let index = VirtualTask.RunningTaskList.indexOf(this);
        if (index >= 0) {
            VirtualTask.RunningTaskList.splice(index, 1);
        }
        this.cancelTaskTimeout();
        if (this._onCompleteHandle) {
            this._onCompleteHandle.execute(this);
        }
        if (this._parentTask) {
            this._parentTask.onChildTaskComplete(this);
        }
    }

    protected onTaskSuccess() {
        if (this._onSuccessHandle) {
            this._onSuccessHandle.execute(this);
        }
        if (this._parentTask) {
            this._parentTask.onChildTaskSuccess(this);
        }
        this.onTaskComplete();
    }

    protected onTaskFail() {
        if (this._onFailHandle) {
            this._onFailHandle.execute(this);
        }
        if (this._parentTask) {
            this._parentTask.onChildTaskFail(this);
        }
        this.onTaskComplete();
    }

    protected onBegin() {

    }

    protected onStoped() {

    }

    protected onPause() {

    }

    protected onResume() {

    }
}
