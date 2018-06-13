import Worker from 'sharedworker-loader!./worker.js';

type OptParams = {
  heatTimer: number,
};

class SharedWorker {
  _worker = null;
  _port = null;
  _option = {};
  _topics = new Map();
  _timer = 3 * 1000;

  constructor(option: OptParams) {
    const { heatTimer } = option;
    if (heatTimer) {
      this._timer = heatTimer;
    }
    this._option = { ...option };
    this._worker = new Worker('./worker.js');
    this._port = this._worker.port;
    this._port.onerror = ::this.onError;
    this._port.onmessage = ::this.onMessage;
    this._port.start();
  }

  onError(event) {
    this._port.close();
  }

  onMessage(event) {
    const {
      action,
    } = event.data || {};
    if (action === 'connect') {
      this.onConnected(event);
    } else {
      const handler = this._topics.get(action);
      if (handler) {
        handler(event.data);
      }
    }
  }

  onConnected(event) {
    if (this._topics.has('connect')) {
      const handler = this._topics.get('connect');
      if (typeof handler === 'function') {
        handler();
      }
    }
    this.keep();
    setInterval(() => {
      this.keep();
    }, this._timer);
  }

  keep() {
    this._port.postMessage({
      action: 'heat',
    });
  }

  connect() {
    this._port.postMessage({
      action: 'connect',
      timer: this._timer + 1000,
    });
  }

  emit(topic, message) {
    this._port.postMessage({
      action: 'emit',
      topic,
      message,
    });
  }

  subscribe(topic) {
    this._port.postMessage({
      action: 'subscribe',
      topic,
    });
  }

  on(topic, callback) {
    if (topic === 'connect') {
      this.connect();
    } else {
      this.subscribe(topic);
    }
    if (typeof callback === 'function') {
      this._topics.set(topic, callback);
    }
  }

  join(channel) {
    this._port.postMessage({
      action: 'join',
      channel,
    });
  }

  close() {
    this._port.postMessage({
      action: 'close',
    });
  }
}

export default SharedWorker;
