import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error('❌ Error capturado:', err);

  const status: number = err.status && err.status < 500 ? err.status : 500;
  // Los errores 5xx nunca exponen detalles internos
  const message = status < 500 && err.message ? err.message : 'Error interno del servidor';

  res.status(status).json({ success: false, message, timestamp: new Date().toISOString() });
}
