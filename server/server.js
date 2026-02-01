/* 信令服务器 (Signaling Server) - 连连 */
const WebSocket = require('ws');

// 创建 WebSocket 服务，监听 9001 端口
const wss = new WebSocket.Server({ port: 9001 });

// 保存活跃连接
const clients = new Map();

wss.on('listening', () => {
    console.log('[Signal] 信令服务器已启动，监听端口: 9001');
});

wss.on('connection', (ws) => {
    // 为每个客户端生成 ID (简单随机数，实际可用 UUID)
    const id = Math.random().toString(36).substring(2, 9).toUpperCase();
    clients.set(id, ws);

    console.log(`[Connect] 客户端 ${id} 已连接`);

    // 告知客户端它的 ID
    ws.send(JSON.stringify({ type: 'welcome', id }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const targetId = data.target;

            // 如果有目标ID，尝试找到并转发
            if (targetId) {
                const targetWs = clients.get(targetId);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    console.log(`[Forward] ${id} -> ${targetId}: ${data.type}`);
                    // 将消息转发给目标，并附带发送者ID
                    data.from = id;
                    targetWs.send(JSON.stringify(data));
                } else {
                    console.warn(`[Error] 目标 ${targetId} 未找到或离线`);
                    ws.send(JSON.stringify({ type: 'error', message: `Device ${targetId} not found` }));
                }
            } else {
                console.log(`[Log] 收到 ${id} 消息:`, data);
            }
        } catch (e) {
            console.error('[Error] 消息解析失败:', e);
        }
    });

    ws.on('close', () => {
        console.log(`[Disconnect] 客户端 ${id} 断开连接`);
        clients.delete(id);
    });

    ws.on('error', (err) => {
        console.error(`[Error] 客户端 ${id} 出错:`, err);
    });
});

// 处理未捕获异常
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
