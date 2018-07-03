import io from 'socket.io-client';
import { TOPIC } from './variable';

class Worker {
  _clients = new Set();
  _socket;
  _num = 1;
  _regTopics = new Set();
  _connected = false;
  _rooms = new Map();

  connect(client) {
    this._clients.add(client);
    console.info(`client count : [${this._clients.size}]`);
    if (this._socket && this._connected) {
      client.connected();
    } else {
      this._socket = io('', {
        transports: ['polling', 'websocket']
      });
      this._socket.on(TOPIC.CONNECT, () => {
        this._connected = true;
        this._clients.forEach(c => c.connected());
      });
      this._socket.on(TOPIC.DISCONNECT, () => {
        this._connected = false;
        this._clients.forEach(c => c.disconnect());
      });
      this._socket.on(TOPIC.RECONNECT, (number) => {
        this._clients.forEach(c => c.reconnect(number));
      });
      this._socket.on(TOPIC.RECONNECTING, (number) => {
        this._clients.forEach(c => c.reconnecting(number));
      });
    }
  }

  add() {
    return this._num++;
  }

  on(topic) {
    if (!this._regTopics.has(topic)) {
      this._regTopics.add(topic);
      if (this._socket && this._connected) {
        this._socket.on(topic, (message) => {
          this._clients.forEach(client => {
            if (client._topics.has(topic)) {
              const handler = client._topics.get(topic);
              if (typeof handler === 'function') {
                handler(message);
              }
            }
          });
        });
      }
    }
  }

  emit(topic, message) {
    if (this._socket && this._connected) {
      this._socket.emit(topic, message);
    }
  }

  disconnect(client) {
    this.close(client);
    console.log(`disconnect client [${client._num}], current client count:  [${this._clients.size}]`);
  }

  close(client) {
    if (this._socket && this._connected) {
      this._socket.emit('close', Array.from(client._channels));
    }
    this._clients.delete(client);
  }

  join(channel) {
    const count = this._rooms.get(channel) || 0;
    this._rooms.set(channel, count + 1);
  }
  leave(channel) {
    const count = this._rooms.get(channel) || 0;
    this._rooms.set(channel, count - 1);
    if (count - 1 <= 0) {
      this.emit(TOPIC.LEAVE, channel);
    }
  }
}

const worker = new Worker();

class Client {
  _timer;
  _client;
  _num;
  _time = 3 * 1000;
  _topics = new Map();
  _channels = new Set();
  _connected = false;

  constructor(option) {
    this._client = option.client;
    ::this.init();
  }

  init() {
    this._client.addEventListener('message', ::this.onMessage);
    this._client.start();
  }

  onMessage(event) {
    const { type, timer, channel } = event.data;
    switch (type) {
      case TOPIC.CONNECT:
        this._num = worker.add();
        this._time = timer;
        break;
      case TOPIC.SUBSCRIBE:
        this.subscribe(event);
        break;
      case TOPIC.EMIT:
        this.emit(event);
        break;
      case TOPIC.HEAT:
        this.heat();
        break;
      case TOPIC.CLOSE:
        worker.close(this);
        break;
      case TOPIC.JOIN:
        this._channels.add(channel);
        const topic = `${channel}_message`;
        this._topics.set(topic, (message) => {
          this._client.postMessage({
            type: topic,
            content: message,
          });
        });
        worker.on(topic);
        worker.emit(TOPIC.JOIN, channel);
        worker.join(channel);
        break;
      case TOPIC.LEAVE:
        this._channels.delete(channel);
        worker.leave(channel);
        break;
    }
  }

  subscribe = (event) => {
    const {
      topic,
    } = event.data || {};
    if (!this._topics.has(topic)) {
      this._topics.set(topic, (message) => {
        this._client.postMessage({
          type: topic,
          content: message,
        });
      });
      worker.on(topic);
    }
  };

  emit = (event) => {
    const { topic, content } = event.data || {};
    worker.emit(topic, content);
  };

  heat = () => {
    this.clearTimer();
    let count = 0;
    this._timer = setInterval(() => {
      if (count > 3 && this._timer) {
        this.clearTimer();
        this._client.close();
        this._channels.forEach(channel => {
          worker.leave(channel)
        });
        worker.disconnect(this);
      }
      count += 1;
    }, this._time);
  };

  clearTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  connected() {
    this._connected = true;
    this._client.postMessage({
      type: TOPIC.CONNECT,
    });
    for (const channel of this._channels.values()) {
      worker.emit(TOPIC.JOIN, channel);
    }
    for (const topic of this._topics.keys()) {
      worker.on(topic);
    }
  }

  disconnect() {
    this._connected = false;
    this._client.postMessage({
      type: TOPIC.DISCONNECT,
    });
  }

  reconnect(number) {
    this._client.postMessage({
      type: TOPIC.RECONNECT,
      content: number,
    });
  }

  reconnecting(number) {
    this._client.postMessage({
      type: TOPIC.RECONNECTING,
      content: number,
    });
  }

  start() {
    this._client.start();
  }
}

onconnect = (event) => {
  const client = event.ports[0];
  worker.connect(new Client({
    client,
  }));
};
