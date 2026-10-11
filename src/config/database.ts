import mongoose from 'mongoose';
import { config } from './env';

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`🍃 Conexión exitosa a MongoDB: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error: any) {
    console.error('❌ Error al conectar a MongoDB:', error.message);
    console.error('   💡 Sugerencia:');
    console.error('      1. Si usas MongoDB local, verifica que el servicio esté iniciado: `net start MongoDB` o `mongod`.');
    console.error('      2. O utiliza una base de datos en la nube con MongoDB Atlas:');
    console.error('         Modifica MONGODB_URI en .env con tu string: mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/eduportal');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
