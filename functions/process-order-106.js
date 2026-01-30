const fetch = require('node-fetch');

async function processOrder() {
  const storeId = '6854698';
  const orderId = '106';
  
  // Primero obtener el accessToken desde tu API
  const storeInfo = await fetch(`https://apipromonube-jlfopowzaq-uc.a.run.app/store-info?storeId=${storeId}`);
  const storeData = await storeInfo.json();
  const accessToken = storeData.store.accessToken;
  
  console.log('🔍 Obteniendo orden #106...');
  
  // Obtener la orden de TiendaNube
  const orderResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/orders/${orderId}`, {
    headers: {
      'Authentication': `bearer ${accessToken}`,
      'User-Agent': 'PromoNube (contacto@promonube.com)'
    }
  });
  
  if (!orderResponse.ok) {
    console.error('❌ Error obteniendo orden:', orderResponse.status);
    return;
  }
  
  const order = await orderResponse.json();
  
  console.log('📦 Orden obtenida:', order.number);
  console.log('💰 Total:', order.total);
  console.log('📊 Payment status:', order.payment_status);
  console.log('🛍️ Productos:');
  order.products.forEach(p => {
    console.log(`   - ${p.name} ($${p.price})`);
  });
  
  // Enviar al webhook
  console.log('\n📤 Enviando al webhook...');
  
  const webhookResponse = await fetch('https://apipromonube-jlfopowzaq-uc.a.run.app/api/webhooks/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(order)
  });
  
  const result = await webhookResponse.json();
  console.log('✅ Respuesta del webhook:', result);
}

processOrder().catch(console.error);
