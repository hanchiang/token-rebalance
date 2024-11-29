import EventEmitter from 'events';

export class MyEventEmitter {
    static instance: MyEventEmitter;
    emitter: EventEmitter;

    private constructor(emitter: EventEmitter) {
        this.emitter = emitter;
    }

    public static getInstance() {
        if (MyEventEmitter.instance != null) {
            return MyEventEmitter.instance;
        }
        MyEventEmitter.instance = new MyEventEmitter(new EventEmitter());
        return MyEventEmitter.instance;
    }

    public getEmitter(): EventEmitter {
        return this.emitter;
    }
}