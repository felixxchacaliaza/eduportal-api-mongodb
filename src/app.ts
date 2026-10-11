import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import authRoutes from './routes/auth.routes';
import studentRoutes from './routes/student.routes';
import subjectRoutes from './routes/subject.routes';
import gradeRoutes from './routes/grade.routes';
import userRoutes from './routes/user.routes';
import profileRoutes from './routes/profile.routes';
import configRoutes from './routes/config.routes';
import gradeSectionRoutes from './routes/grade-section.routes';
import teacherRoutes from './routes/teacher.routes';
import { authenticate } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: [config.corsOrigin], credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Endpoint de salud (público, sin datos sensibles)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'EduPortal REST API (MongoDB)',
    database: 'MongoDB',
    timestamp: new Date().toISOString()
  });
});

// Autenticación (login público; /me y /change-password exigen token en su router)
app.use('/api/auth', authRoutes);

// Todo lo demás exige un token válido; cada router aplica además su permiso por módulo
app.use('/api', authenticate as any);
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/config', configRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/grade-sections', gradeSectionRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Recurso no encontrado' });
});

app.use(errorHandler);

export default app;
