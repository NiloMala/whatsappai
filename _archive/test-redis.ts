const { createClient } = require('redis');

const REDIS_CONFIG = {
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    password: process.env.REDIS_PASSWORD || undefined
};

async function testRedisConnection() {
  const client = createClient(REDIS_CONFIG);

  // Manipular eventos
  client.on('error', (err: Error) => console.log('Redis Client Error', err));
  client.on('ready', () => console.log('Redis Client Ready'));
  client.on('connect', () => console.log('Redis Client Connected'));
  client.on('end', () => console.log('Redis Client Connection Ended'));

  try {
    await client.connect();
    console.log('✅ Conexão Redis OK!');
    
    // Teste simples de escrita/leitura
    await client.set('test', 'working');
    const value = await client.get('test');
    console.log('Teste de leitura/escrita:', value);
    
  } catch (error) {
    console.error('❌ Erro na conexão Redis:', error);
  } finally {
    await client.quit();
  }
}

testRedisConnection();