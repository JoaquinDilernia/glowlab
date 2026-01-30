const admin = require('firebase-admin');
const serviceAccount = require('./google-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
  // Ver TODAS las ruletas sin filtro
  const allWheels = await db.collection('spin_wheels').limit(20).get();
  console.log(`\n📊 Total ruletas en la DB: ${allWheels.size}\n`);
  
  allWheels.forEach(doc => {
    const d = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Store: ${d.storeId}`);
    console.log(`  Activa: ${d.active}`);
    console.log(`  Título: ${d.title || 'Sin título'}`);
    console.log(`  Premios: ${(d.prizes || d.segments || []).length}`);
    console.log('');
  });
  
  const snapshot = await db.collection('spin_wheels')
    .where('storeId', '==', 'demo-NubeSheets')
    .get();
  
  if (snapshot.empty) {
    console.log('\n❌ No hay ruleta específica para demo-NubeSheets');
    process.exit(0);
  }
  
  snapshot.forEach(doc => {
    const d = doc.data();
    const prizes = d.prizes || d.segments || [];
    console.log('RULETA:', doc.id);
    console.log('\nPREMIOS:');
    let total = 0;
    prizes.forEach((p,i) => {
      console.log(`  [${i}] ${p.label}: ${p.probability}% - Tipo: ${p.type}, Valor: ${p.value}`);
      total += p.probability;
    });
    console.log(`\nTOTAL PROBABILIDAD: ${total}%`);
  });
  
  process.exit(0);
}

check();
