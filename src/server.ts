import app from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';

async function bootstrap() {
  try {
    await connectDatabase();

    const server = app.listen(config.port, () => {
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`🚀 EduPortal REST API (MongoDB) escuchando en: http://localhost:${config.port}`);
      console.log(`   - Health check:     http://localhost:${config.port}/api/health`);
      console.log(`   - Endpoints Auth:   http://localhost:${config.port}/api/auth/login`);
      console.log(`   - Estudiantes:      http://localhost:${config.port}/api/students`);
      console.log(`   - Cursos/Subjects:  http://localhost:${config.port}/api/subjects`);
      console.log(`   - Calificaciones:   http://localhost:${config.port}/api/grades`);
      console.log(`   - CORS Habilitado:  ${config.corsOrigin}`);
      console.log(`   - Base de Datos:    MongoDB (${config.mongodbUri})`);
      console.log('═══════════════════════════════════════════════════════════');
    });

    const shutdown = async () => {
      console.log('\nCerrando servidor EduPortal API...');
      server.close(async () => {
        await disconnectDatabase();
        console.log('Servidor EduPortal API y conexión MongoDB cerrados.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('No se pudo iniciar el servidor debido a error en la base de datos:', error);
    process.exit(1);
  }
}

bootstrap();
