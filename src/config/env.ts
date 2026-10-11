import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length < 32) {
    throw new Error(
      `Variable de entorno ${name} ausente o demasiado corta (mínimo 32 caracteres). ` +
      `Copia .env.example a .env y define un valor seguro.`
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/eduportal',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  defaultPassword: process.env.DEFAULT_PASSWORD || '12345678'
};
