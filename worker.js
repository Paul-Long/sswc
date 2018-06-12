class Worker {
  constructor() {

  }

  connect() {

  }

  emit() {

  }

  regTopic() {

  }

  disconnect() {

  }

  reconnecting() {

  }
}

const worker = new Worker();

self.addEventListener('connect', function (event) {
  const client = event.ports[0];
  console.log('client connect', client);
  client.addEventListener('message', function (e) {
    let action = event.data.action;
    if (action === '') {
      client.postMessage({
        action: 'connect',
        data: 'connect success'
      });
    }
  });
});
