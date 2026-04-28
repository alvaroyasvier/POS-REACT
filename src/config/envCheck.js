// backend/src/config/envCheck.js
const requiredEnvVars = [
  'JWT_SECRET',
  'LICENSE_SECRET',
  'DATABASE_URL'
];

const optionalEnvVars = [
  'PORT',
  'NODE_ENV',
  'FRONTEND_URL'
];

export function checkEnv() {
  const missing = [];
  for (const env of requiredEnvVars) {
    if (!process.env[env]) {
      missing.push(env);
    }
  }
  if (missing.length > 0) {
    console.error('❌ ERROR: Variables de entorno requeridas no definidas:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('Por favor, define estas variables en el archivo .env');
    process.exit(1);
  }
  console.log('✅ Variables de entorno requeridas validadas');
  // Opcional: mostrar valores (ocultando parcialmente)
  console.log(`   JWT_SECRET: ${process.env.JWT_SECRET.substring(0, 3)}...`);
  console.log(`   LICENSE_SECRET: ${process.env.LICENSE_SECRET.substring(0, 3)}...`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL.split('@')[1] || 'configurada'}`);
}