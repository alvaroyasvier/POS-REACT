// backend/src/config/envCheck.js
export function checkEnv() {
  const required = ['JWT_SECRET', 'LICENSE_SECRET', 'DATABASE_URL'];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length) {
    console.warn('⚠️  Variables de entorno no definidas:', missing.join(', '));
    console.warn('   Asegúrate de tenerlas en el archivo .env');
    // No detiene el servidor
  } else {
    console.log('✅ Variables de entorno requeridas validadas');
    console.log('   JWT_SECRET: tu_...');
    console.log('   LICENSE_SECRET: POS...');
    console.log('   DATABASE_URL: localhost:5432/pos_db?sslmode=disable');
  }
}