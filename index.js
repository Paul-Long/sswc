import Worker from 'sharedworker-loader!./worker.js';
import { TOPIC } from './variable';

class SharedWorker {
  _worker = null;
  _port = null;
  _option = {};
  _topics = new Map();
  _timer = 3 * 1000;

  constructor(option) {
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
      type: topic,
      content,
    } = event.data || {};
    if (topic === TOPIC.CONNECT) {
      this.onConnected(event);
    } else {
      const handler = this._topics.get(topic);
      handler && handler(content);
    }
  }

  onConnected(event) {
    if (this._topics.has(TOPIC.CONNECT)) {
      const handler = this._topics.get(TOPIC.CONNECT);
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
      type: TOPIC.HEAT,
    });
  }

  connect() {
    this._port.postMessage({
      type: TOPIC.CONNECT,
      timer: this._timer + 1000,
    });
  }

  emit(topic, content) {
    this._port.postMessage({
      type: TOPIC.EMIT,
      topic,
      content,
    });
  }

  subscribe(topic) {
    this._port.postMessage({
      type: TOPIC.SUBSCRIBE,
      topic,
    });
  }

  on(topic, callback) {
    if (topic === TOPIC.CONNECT) {
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
      type: TOPIC.JOIN,
      channel,
    });
  }

  leave(channel) {
    this._port.postMessage({
      type: TOPIC.LEAVE,
      channel,
    });
  }

  close() {
    this._port.postMessage({
      type: TOPIC.CLOSE,
    });
  }
}

export default SharedWorker;
