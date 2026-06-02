import Fastify from 'fastify';

const PORT = parseInt(process.env.MQTT_BRIDGE_PORT || '3002', 10);
const HOST = process.env.API_HOST || '0.0.0.0';

const app = Fastify({ logger: true });

app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'mqtt-bridge',
    timestamp: Date.now(),
  };
});

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`MQTT Bridge server listening at ${address}`);
});
