import { store } from "../Common/LocalStorageManager";

export default class SoundManager {
    private static _instance: SoundManager = null;

    static instance(): SoundManager {
        if (!this._instance)
            this._instance = new SoundManager();
        return this._instance;
    }

    public static STORAGE_KEY_MUSIC_OPEN = "isMusicOpen";
    public static STORAGE_KEY_VOICE_OPEN = "isVoiceOpen";

    _MusicVolume: number;
    _VoiceVolume: number;

    _isVoiceOpen: boolean;
    _isMusicOpen: boolean;

    protected currMusicName: string;
    protected currMucisAudioID: number;
    protected currVoiceList: number[];

    private constructor() {

    }

    init() {
        this._isVoiceOpen = this._isMusicOpen = true;
        
        store.getStorageItemAsync(SoundManager.STORAGE_KEY_MUSIC_OPEN, this.onGetStorageComplete.bind(this));
        store.getStorageItemAsync(SoundManager.STORAGE_KEY_VOICE_OPEN, this.onGetStorageComplete.bind(this));

        this.currMucisAudioID = -1;
        this.currVoiceList = [];
    }

    protected onGetStorageComplete(key: string, value: any) {
        if (key == SoundManager.STORAGE_KEY_MUSIC_OPEN) {
            this._isMusicOpen = value == null ? true : value;
        }
        else if (key == SoundManager.STORAGE_KEY_VOICE_OPEN) {
            this._isVoiceOpen = value == null ? true : value;
        }
    }


    /**
     * 播放游戏音效，一般是播放一次
     * @param {string} soundName 音效路径
     * @param {number} loopCount 循环次数
     * @param isSilentBgMusic    播放期间是否要静音背景音乐
     */
    public playVoice(soundName: cc.AudioClip, loopCount: number = 1, isSilentBgMusic: boolean = false) {
        if (!soundName || !this._isVoiceOpen) {
            return;
        }
        try {
            cc.audioEngine.playEffect(soundName, false);
        }
        catch (err) {
            console.warn("play voice error:", err);
        }
        return;
    }

    protected onEffectFinish(id: number, overCount: number) {
    }

    public stopAllEffect() {
        cc.audioEngine.stopAllEffects();
    }

    stopMusic() {
        if (this.currMucisAudioID != -1) {
            cc.audioEngine.stopMusic();
            this.currMucisAudioID = -1;
        }
        this.currMusicName = null;
    }

    /**
     * 播放背景音乐
     * @param {string} musicName
     */
    public playMusic(music: string | cc.AudioClip) {
        let isAudioClip = music && (music instanceof cc.AudioClip);
        let musicName: string = music ? (music instanceof cc.AudioClip ? music.name : music) : null;
        if (this.currMusicName != musicName) {
            this.stopMusic();
            if (!musicName || musicName.length == 0 || !this._isMusicOpen) {
                return;
            }
            this.currMusicName = musicName;
            if (isAudioClip) {
                this._playMusicAudioClip(music);
            }
            else {
                this._playMusic();
            }
        }
    }
    protected _playMusic() {
        let audio: cc.AudioClip = cc.loader.getRes(this.currMusicName);
        if (audio) {
            this.currMucisAudioID = cc.audioEngine.playMusic(audio, true);
        }
        else {
            cc.loader.load(this.currMusicName, this.onMusicLoadComplete.bind(this));
        }
    }

    /**
     * 播放背景乐(直接播放, 无需再次加载)
     * @param music 
     */
    protected _playMusicAudioClip(music) {
        this.currMucisAudioID = cc.audioEngine.playMusic(music, true);
    }


    protected onMusicLoadComplete(err: any, res: cc.AudioClip) {
        if (this._isMusicOpen && res && res.name == this.currMusicName) {
            this.currMucisAudioID = cc.audioEngine.playMusic(res, true);
        }
    }


    set isOpenVoiceSound(value: boolean) {
        if (this._isVoiceOpen != value) {
            store.setStorageItem(SoundManager.STORAGE_KEY_VOICE_OPEN, value);
            this._isVoiceOpen = value;
            if (!this._isVoiceOpen) {
                cc.audioEngine.stopAllEffects();
            }
        }
    }
    get isOpenVoiceSound() {
        return this._isVoiceOpen;
    }
    set isOpenMusicSound(value: boolean) {
        if (this._isMusicOpen != value) {
            store.setStorageItem(SoundManager.STORAGE_KEY_MUSIC_OPEN, value);
            this._isMusicOpen = value;
            if (this._isMusicOpen) {
                if (this.currMusicName && this.currMusicName.length == 0) {
                    this._playMusic();
                }
            }
            else {
                let oldMusicName: string = this.currMusicName;
                this.stopMusic();
                this.currMusicName = oldMusicName;
            }
        }
    }
    get isOpenMusicSound() {
        return this._isMusicOpen;
    }
}

export var sound = SoundManager.instance();