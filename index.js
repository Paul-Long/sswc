import Worker from 'sharedworker-loader!./worker.js';

type OptParams = {
  clientId: string,
};

class SharedWorker {
  _worker = null;
  _port = null;
  _option = {};

  constructor(option: OptParams) {
    if (!option.clientId) {
      throw new Error(`[clientId] : shared worker clientId is ${option.clientId}`);
    }

    this._option = { ...option };
    this._worker = new Worker('./worker.js');
    this._port = this._worker.port;
    this._port.onerror = this.onError;
    this._port.onmessage = this.onMessage;
    this._port.start();
  }

  onError(event) {
    this._port.close();
  }

  onMessage(event) {
    console.log(event, event.data);
  }

  onConnected(event) {

  }

  onClose(event) {

  }

  connect() {
    this._port.postMessage({
      action: 'connect',
    });
  }

  emit(topic, message) {

  }

  subscribe(topic) {

  }

  on(topic) {

  }

  close() {

  }
}

export default SharedWorker;
