import AbstractDialog, { DialogOpsHandle, DialogOpsHandleWrapper, DialogTypicalTypes } from "./AbstractDialog";

import { PanelShowParams } from "../../Frame/SceneFrame";
import AskDialog from "./AskDialog";
import ConfirmDialog from "./ComfirmDialog";
import CancelDialog from "./CancelDialog";
import { gameGlobal } from "../../GameGlobal";

export class MessageManager {
    private static _instance: MessageManager = null;
    static instance():MessageManager {
        if (!this._instance)
            this._instance = new MessageManager();
        return this._instance;
    }

    public AskDialog(msg: string, handler: DialogOpsHandle | DialogOpsHandleWrapper, tag: string | number = DialogTypicalTypes.ASK, params?: PanelShowParams): AskDialog {
        return gameGlobal.$SceneFrame.showAskDialog(msg, handler, tag, params);
    }

    public ConfirmDialog(msg: string, handler: DialogOpsHandle | DialogOpsHandleWrapper, tag: string | number = DialogTypicalTypes.CONFIRM, params?: PanelShowParams): ConfirmDialog {
        return gameGlobal.$SceneFrame.showConfirmDialog(msg, handler, tag, params);
    }

    public CancelDialog(msg: string, handler: DialogOpsHandle | DialogOpsHandleWrapper, tag: string | number = DialogTypicalTypes.CANCEL, params?: PanelShowParams): CancelDialog {
        return gameGlobal.$SceneFrame.showCancelDialog(msg, handler, tag, params);
    }

    public Tips(msg: string, timeout: number = 2000, handler?: DialogOpsHandle | DialogOpsHandleWrapper, tag: string | number = DialogTypicalTypes.MESSAGE_BOX, params: PanelShowParams = { dialogStyle: { isModal: false } }): AbstractDialog {
        return gameGlobal.$SceneFrame.showMessagePanel(msg, timeout, handler, tag, params);
    }
}

export var msg = MessageManager.instance();