import io from 'socket.io-client';

class Worker {
  _clients = new Set();
  _socket;
  _num = 1;
  _regTopics = new Set();
  _connected = false;

  connect(client) {
    this._clients.add(client);
    console.info(`client count : [${this._clients.size}]`);
    if (this._socket && this._connected) {
      client.connected();
    } else {
      this._socket = io('', {
        transports: ['polling', 'websocket']
      });
      this._socket.on('connect', () => {
        this._connected = true;
        this._clients.forEach(c => c.connected());
      });
      this._socket.on('disconnect', () => {
        this._connected = false;
        this._clients.forEach(c => c.disconnect());
        this._clients.clear();
      });
      this._socket.on('reconnecting', (number) => {
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
}

const worker = new Worker();

type ClientOpt = {
  client: any,
}

class Client {
  _timer;
  _client;
  _num;
  _time = 3 * 1000;
  _topics = new Map();
  _channels = new Set();
  _connected = false;

  constructor(option: ClientOpt) {
    this._client = option.client;
    ::this.init();
  }

  init() {
    this._client.addEventListener('message', ::this.onMessage);
    this._client.start();
  }

  onMessage(event) {
    const { action, timer, channel } = event.data;
    switch (action) {
      case 'connect':
        this._num = worker.add();
        this._time = timer;
        break;
      case 'subscribe':
        this.subscribe(event);
        break;
      case 'emit':
        this.emit(event);
        break;
      case 'heat':
        this.heat();
        break;
      case 'close':
        worker.close(this);
        break;
      case 'join':
        this._channels.add(channel);
        worker.emit('join', channel);
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
          action: topic,
          message,
        });
      });
      worker.on(topic);
    }
  };

  emit = (event) => {
    const { topic, message } = event.data || {};
    worker.emit(topic, message);
  };

  heat = () => {
    this.clearTimer();
    this._timer = setTimeout(() => {
      this.clearTimer();
      this._client.close();
      worker.disconnect(this);
    }, this._time);
  };

  clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  connected() {
    this._connected = true;
    this._client.postMessage({
      action: 'connect'
    });
  }

  disconnect() {
    this._connected = false;
    this._client.postMessage({
      action: 'disconnect'
    });
  }

  reconnecting(number) {
    this._client.postMessage({
      action: 'reconnecting',
      number,
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
