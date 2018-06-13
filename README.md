# sswc
socket.io-client shared worker 

## Install
```bash
npm install --save
```

## API

- emit(topic, message): 发送一个message事件
- on(topic, callback): 注册一个事件处理器
- close: 手动关闭
- join(channel): 加入room