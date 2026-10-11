/**
 * ==============================================================================
 * SCRIPT INICIAL DE INSERCIÓN PARA MONGODB (mongosh / native script)
 * ==============================================================================
 * Base de Datos: eduportal
 * Ejecución desde terminal:
 *    mongosh mongodb://localhost:27017/eduportal init-mongo.js
 * O pegar directamente en la pestaña "mongosh" de MongoDB Compass.
 * ==============================================================================
 */

// 1. Conexión o cambio a la base de datos 'eduportal'
const dbTarget = db.getSiblingDB('eduportal');
print('🍃 Conectado a la base de datos: ' + dbTarget.getName());

// 2. Limpieza de datos anteriores (opcional, para inicialización limpia)
print('🧹 Limpiando colecciones anteriores...');
dbTarget.school_settings.drop();
dbTarget.profiles.drop();
dbTarget.academic_years.drop();
dbTarget.grade_sections.drop();
dbTarget.subjects.drop();
dbTarget.grade_subjects.drop();
dbTarget.teachers.drop();
dbTarget.students.drop();
dbTarget.grades.drop();
dbTarget.users.drop();

// Hash bcrypt de '12345678' para las contraseñas iniciales
const DEFAULT_PASSWORD_HASH = '$2a$10$2W.2uZyqDtu9i0B79cJhJuWhEtWAfUNnBHXo6FiFEnrBd16lkh3UC';

// ==============================================================================
// 1° PASO: Identidad Escolar (school_settings)
// ==============================================================================
print('🏫 1. Creando Configuración Escolar...');
dbTarget.school_settings.insertOne({
  _id: 'school-main',
  schoolName: 'I.E. República de Colombia',
  modularCode: '0345892',
  annexCode: '00',
  educationalLevel: 'Secundaria de Menores',
  schoolUgel: 'UGEL 03 - Lima Metropolitana',
  schoolDre: 'DRE Lima Metropolitana',
  address: 'Av. Los Próceres 450, Lima',
  phone: '(01) 456-7890',
  officialEmail: 'contacto@colegiocolombia.edu.pe',
  website: 'https://colegiocolombia.edu.pe',
  principalName: 'Lic. Roberto Castillo Mendoza',
  passingScore: 11,
  minAttendancePercent: 70,
  maxWeeklyHours: 35,
  currency: 'PEN',
  currencySymbol: 'S/.',
  timezone: 'America/Lima',
  academicCycle: 'BIMESTRAL',
  bimestersCount: 4,
  createdAt: new Date(),
  updatedAt: new Date()
});

// ==============================================================================
// 2° PASO: Perfiles y Permisos RBAC (profiles)
// ==============================================================================
print('🔐 2. Creando Perfiles de Acceso (RBAC)...');
dbTarget.profiles.insertMany([
  {
    _id: 'prof-super-admin',
    name: 'Perfil Super Administrador',
    description: 'Acceso total y sin restricciones a todos los módulos y opciones.',
    icon: 'shield_person',
    colorClass: 'prof-amber',
    isSystem: true,
    options: [
      { optionKey: 'dashboard', level: 'FULL' },
      { optionKey: 'students', level: 'FULL' },
      { optionKey: 'staff', level: 'FULL' },
      { optionKey: 'grades', level: 'FULL' },
      { optionKey: 'grade_sections', level: 'FULL' },
      { optionKey: 'grade_subjects', level: 'FULL' },
      { optionKey: 'subjects', level: 'FULL' },
      { optionKey: 'access_control', level: 'FULL' },
      { optionKey: 'school_config', level: 'FULL' }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'prof-admin',
    name: 'Perfil Administrador',
    description: 'Control total de módulos administrativos y solo lectura en pedagógicos.',
    icon: 'admin_panel_settings',
    colorClass: 'prof-blue',
    isSystem: true,
    options: [
      { optionKey: 'students', level: 'READ_ONLY' },
      { optionKey: 'staff', level: 'READ_ONLY' },
      { optionKey: 'grades', level: 'READ_ONLY' },
      { optionKey: 'grade_sections', level: 'READ_ONLY' },
      { optionKey: 'grade_subjects', level: 'READ_ONLY' },
      { optionKey: 'subjects', level: 'READ_ONLY' },
      { optionKey: 'access_control', level: 'FULL' },
      { optionKey: 'school_config', level: 'FULL' }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'prof-docente',
    name: 'Perfil Docente de Secundaria',
    description: 'Acceso al Dashboard e ingreso completo de calificaciones.',
    icon: 'school',
    colorClass: 'prof-green',
    isSystem: true,
    options: [
      { optionKey: 'dashboard', level: 'READ_ONLY' },
      { optionKey: 'grades', level: 'FULL' }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'prof-alumno',
    name: 'Perfil Alumno / Estudiante',
    description: 'Acceso de consulta al panel general de información.',
    icon: 'backpack',
    colorClass: 'prof-teal',
    isSystem: true,
    options: [
      { optionKey: 'dashboard', level: 'READ_ONLY' }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// ==============================================================================
// 3° PASO: Año Lectivo con Bimestres (academic_years)
// ==============================================================================
print('📅 3. Creando Año Lectivo 2026...');
dbTarget.academic_years.createIndex({ year: 1 }, { unique: true });
dbTarget.academic_years.insertOne({
  _id: 'ay-2026',
  year: 2026,
  name: 'Año Escolar 2026',
  startsAt: new Date('2026-03-09'),
  endsAt: new Date('2026-12-19'),
  isActive: true,
  bimesters: [
    { _id: 'bim-1-2026', number: 1, startsAt: new Date('2026-03-09'), endsAt: new Date('2026-05-15'), isOpen: false },
    { _id: 'bim-2-2026', number: 2, startsAt: new Date('2026-05-25'), endsAt: new Date('2026-07-31'), isOpen: false },
    { _id: 'bim-3-2026', number: 3, startsAt: new Date('2026-08-10'), endsAt: new Date('2026-10-16'), isOpen: true },
    { _id: 'bim-4-2026', number: 4, startsAt: new Date('2026-10-26'), endsAt: new Date('2026-12-19'), isOpen: false }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
});

// ==============================================================================
// 4° PASO: Aulas y Secciones (grade_sections)
// ==============================================================================
print('🏫 4. Creando Secciones Escolares...');
dbTarget.grade_sections.createIndex({ grade: 1, section: 1 }, { unique: true });
dbTarget.grade_sections.insertMany([
  { _id: 'sec-1-a', grade: '1° Secundaria', section: 'A', classroom: 'Aula 101', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'sec-1-b', grade: '1° Secundaria', section: 'B', classroom: 'Aula 102', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'sec-2-a', grade: '2° Secundaria', section: 'A', classroom: 'Aula 201', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'sec-2-b', grade: '2° Secundaria', section: 'B', classroom: 'Aula 202', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'sec-3-a', grade: '3° Secundaria', section: 'A', classroom: 'Aula 301', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'sec-3-b', grade: '3° Secundaria', section: 'B', classroom: 'Aula 302', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'sec-4-a', grade: '4° Secundaria', section: 'A', classroom: 'Aula 401', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'sec-4-b', grade: '4° Secundaria', section: 'B', classroom: 'Aula 402', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'sec-5-a', grade: '5° Secundaria', section: 'A', classroom: 'Aula 501', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() },
  { _id: 'sec-5-b', grade: '5° Secundaria', section: 'B', classroom: 'Aula 502', maxCapacity: 30, shift: 'MAÑANA', status: 'ACTIVE', assignedSubjects: 11, weeklyHours: 35, createdAt: new Date(), updatedAt: new Date() }
]);

// ==============================================================================
// 5° PASO: Cursos Curriculares Oficiales MINEDU (subjects)
// ==============================================================================
print('📚 5. Creando Cursos Oficiales (subjects)...');
dbTarget.subjects.createIndex({ code: 1 }, { unique: true });
dbTarget.subjects.insertMany([
  { _id: 'cur-mat-100', code: 'MAT-100', name: 'Matemática', category: 'CIENCIAS', specialty: 'Matemática', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Carlos Mendoza', weeklyHours: 5, enrolledCount: 100, maxCapacity: 120, icon: '📐', color: '#2563eb', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-com-100', code: 'COM-100', name: 'Comunicación', category: 'HUMANIDADES', specialty: 'Comunicación', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Ana María Velásquez', weeklyHours: 5, enrolledCount: 100, maxCapacity: 120, icon: '📖', color: '#059669', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-ing-100', code: 'ING-100', name: 'Inglés', category: 'IDIOMAS', specialty: 'Idiomas', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. John Smith', weeklyHours: 3, enrolledCount: 100, maxCapacity: 120, icon: '🌍', color: '#7c3aed', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-cyt-100', code: 'CYT-100', name: 'Ciencia y Tecnología', category: 'CIENCIAS', specialty: 'Ciencias Naturales', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Elena Morales', weeklyHours: 4, enrolledCount: 100, maxCapacity: 120, icon: '🧪', color: '#0284c7', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-soc-100', code: 'SOC-100', name: 'Ciencias Sociales', category: 'HUMANIDADES', specialty: 'Ciencias Sociales', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Patricia Flores', weeklyHours: 3, enrolledCount: 100, maxCapacity: 120, icon: '🏛️', color: '#d97706', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-dpcc-100', code: 'DPCC-100', name: 'Desarrollo Personal, Ciudadanía y Cívica', category: 'HUMANIDADES', specialty: 'Humanidades', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Gabriel Vargas', weeklyHours: 3, enrolledCount: 100, maxCapacity: 120, icon: '⚖️', color: '#4f46e5', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-ept-100', code: 'EPT-100', name: 'Educación para el Trabajo', category: 'TECNOLOGÍA', specialty: 'Tecnología', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Roberto Paredes', weeklyHours: 2, enrolledCount: 100, maxCapacity: 120, icon: '💻', color: '#0891b2', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-art-100', code: 'ART-100', name: 'Arte y Cultura', category: 'ARTES', specialty: 'Artes', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Rosa Chávez', weeklyHours: 3, enrolledCount: 100, maxCapacity: 120, icon: '🎨', color: '#db2777', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-edf-100', code: 'EDF-100', name: 'Educación Física', category: 'CIENCIAS', specialty: 'Educación Física', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Javier Morales', weeklyHours: 3, enrolledCount: 100, maxCapacity: 120, icon: '⚽', color: '#16a34a', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-rel-100', code: 'REL-100', name: 'Educación Religiosa', category: 'HUMANIDADES', specialty: 'Religión', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Silvia Ramos', weeklyHours: 2, enrolledCount: 100, maxCapacity: 120, icon: '🕊️', color: '#e11d48', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  { _id: 'cur-toe-100', code: 'TOE-100', name: 'Tutoría y Orientación Educativa', category: 'HUMANIDADES', specialty: 'Tutoría', grade: 'Secundaria (1° a 5°)', section: 'Común', classroom: 'Aula Oficial', teacherName: 'Prof. Manuel Espinoza', weeklyHours: 2, enrolledCount: 100, maxCapacity: 120, icon: '🧭', color: '#ea580c', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() }
]);

// ==============================================================================
// 6° PASO: Malla Curricular por Grado (grade_subjects)
// ==============================================================================
print('📋 6. Asignando Malla Curricular a los 5 grados de Secundaria...');
dbTarget.grade_subjects.createIndex({ grade: 1, subjectId: 1 }, { unique: true });
const gradesList = ['1° Secundaria', '2° Secundaria', '3° Secundaria', '4° Secundaria', '5° Secundaria'];
const subjectIdsList = [
  'cur-mat-100', 'cur-com-100', 'cur-ing-100', 'cur-cyt-100', 'cur-soc-100',
  'cur-dpcc-100', 'cur-ept-100', 'cur-art-100', 'cur-edf-100', 'cur-rel-100', 'cur-toe-100'
];

const gradeSubjectsDocs = [];
for (const gr of gradesList) {
  for (const sId of subjectIdsList) {
    gradeSubjectsDocs.push({
      _id: `gs-${gr.substring(0, 1)}-${sId}`,
      grade: gr,
      subjectId: sId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
}
dbTarget.grade_subjects.insertMany(gradeSubjectsDocs);

// ==============================================================================
// 7° PASO: Plana Docente (teachers)
// ==============================================================================
print('👨‍🏫 7. Creando Docentes Oficiales con Jornada...');
dbTarget.teachers.createIndex({ dni: 1 }, { unique: true });
dbTarget.teachers.createIndex({ email: 1 }, { unique: true });
dbTarget.teachers.insertMany([
  {
    _id: 'tch-mat-001',
    firstName: 'Carlos Alberto',
    lastName: 'Mendoza Ramos',
    fullName: 'Prof. Carlos Mendoza',
    dni: '10482910',
    email: 'carlos.mendoza.10482910@colegiocolombia.edu.pe',
    phone: '987111001',
    specialty: 'Matemática',
    academicDegree: 'Licenciado en Educación Secundaria - Especialidad Matemática',
    contractHours: 30,
    assignedHours: 15,
    status: 'ACTIVE',
    assignments: [
      { grade: '5° Secundaria', section: 'A', subjectId: 'cur-mat-100', subjectName: 'Matemática', weeklyHours: 5 },
      { grade: '5° Secundaria', section: 'B', subjectId: 'cur-mat-100', subjectName: 'Matemática', weeklyHours: 5 },
      { grade: '4° Secundaria', section: 'A', subjectId: 'cur-mat-100', subjectName: 'Matemática', weeklyHours: 5 }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'tch-com-001',
    firstName: 'Ana María',
    lastName: 'Velásquez Torres',
    fullName: 'Prof. Ana María Velásquez',
    dni: '10482911',
    email: 'ana.velasquez.10482911@colegiocolombia.edu.pe',
    phone: '987111002',
    specialty: 'Comunicación',
    academicDegree: 'Licenciada en Lengua y Literatura',
    contractHours: 30,
    assignedHours: 15,
    status: 'ACTIVE',
    assignments: [
      { grade: '5° Secundaria', section: 'A', subjectId: 'cur-com-100', subjectName: 'Comunicación', weeklyHours: 5 },
      { grade: '5° Secundaria', section: 'B', subjectId: 'cur-com-100', subjectName: 'Comunicación', weeklyHours: 5 },
      { grade: '4° Secundaria', section: 'A', subjectId: 'cur-com-100', subjectName: 'Comunicación', weeklyHours: 5 }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Actualizar docente titular en Subject
dbTarget.subjects.updateOne({ _id: 'cur-mat-100' }, { $set: { teacherId: 'tch-mat-001' } });
dbTarget.subjects.updateOne({ _id: 'cur-com-100' }, { $set: { teacherId: 'tch-com-001' } });

// ==============================================================================
// 8° PASO: Estudiantes (students)
// ==============================================================================
print('👨‍🎓 8. Creando Estudiantes de muestra...');
dbTarget.students.createIndex({ dni: 1 }, { unique: true });
dbTarget.students.createIndex({ studentCode: 1 }, { unique: true });
dbTarget.students.createIndex({ grade: 1, section: 1 });
dbTarget.students.insertMany([
  {
    _id: 'std-001',
    studentCode: 'EST-2026-0001',
    firstName: 'Mateo',
    lastName: 'Quispe Silva',
    dni: '71000001',
    email: 'mateo.quispe.71000001@colegiocolombia.edu.pe',
    phone: '980000001',
    birthDate: new Date('2009-05-14'),
    gender: 'M',
    grade: '5° Secundaria',
    section: 'A',
    classroom: 'Aula 501',
    shift: 'MAÑANA',
    enrollmentStatus: 'MATRICULADO',
    status: 'ACTIVE',
    averageGrade: 18.5,
    emergencyContacts: [
      { name: 'Juan Quispe Ramos', relationship: 'PADRE', phone: '991000001', email: 'juan.quispe@gmail.com', isMainGuardian: true }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'std-002',
    studentCode: 'EST-2026-0002',
    firstName: 'Valeria',
    lastName: 'Flores Mendoza',
    dni: '71000002',
    email: 'valeria.flores.71000002@colegiocolombia.edu.pe',
    phone: '980000002',
    birthDate: new Date('2009-08-22'),
    gender: 'F',
    grade: '5° Secundaria',
    section: 'A',
    classroom: 'Aula 501',
    shift: 'MAÑANA',
    enrollmentStatus: 'MATRICULADO',
    status: 'ACTIVE',
    averageGrade: 17.0,
    emergencyContacts: [
      { name: 'Elena Mendoza Castro', relationship: 'MADRE', phone: '991000002', email: 'elena.mendoza@gmail.com', isMainGuardian: true }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// ==============================================================================
// 9° PASO: Actas de Calificaciones (grades)
// ==============================================================================
print('📝 9. Creando Actas de Notas...');
dbTarget.grades.createIndex({ studentId: 1, subjectId: 1, academicYearId: 1 }, { unique: true });
dbTarget.grades.createIndex({ subjectId: 1 });
dbTarget.grades.insertMany([
  {
    _id: 'grd-001-mat',
    studentId: 'std-001',
    subjectId: 'cur-mat-100',
    academicYearId: 'ay-2026',
    bimester1: 19,
    bimester2: 18,
    bimester3: 19,
    bimester4: null,
    finalAverage: 19,
    isPassing: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'grd-001-com',
    studentId: 'std-001',
    subjectId: 'cur-com-100',
    academicYearId: 'ay-2026',
    bimester1: 18,
    bimester2: 17,
    bimester3: 18,
    bimester4: null,
    finalAverage: 18,
    isPassing: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'grd-002-mat',
    studentId: 'std-002',
    subjectId: 'cur-mat-100',
    academicYearId: 'ay-2026',
    bimester1: 17,
    bimester2: 16,
    bimester3: 18,
    bimester4: null,
    finalAverage: 17,
    isPassing: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// ==============================================================================
// 10° PASO: Cuentas de Acceso (users)
// ==============================================================================
print('👤 10. Creando Cuentas de Usuario para Login...');
dbTarget.users.createIndex({ email: 1 }, { unique: true });
dbTarget.users.createIndex({ dni: 1 }, { unique: true });
dbTarget.users.insertMany([
  // Super Administrador
  {
    _id: 'usr-super-admin',
    name: 'Ing. Alex Valdivia',
    email: 'alex.valdivia.00000001@colegiocolombia.edu.pe',
    dni: '00000001',
    password: DEFAULT_PASSWORD_HASH,
    role: 'ADMIN',
    cargo: 'Super Usuario TI',
    profileId: 'prof-super-admin',
    webAccess: true,
    isActive: true,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlexValdivia',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // Director General
  {
    _id: 'usr-admin',
    name: 'Lic. Roberto Castillo',
    email: 'roberto.castillo.10234567@colegiocolombia.edu.pe',
    dni: '10234567',
    password: DEFAULT_PASSWORD_HASH,
    role: 'DIRECTOR',
    cargo: 'Director General',
    profileId: 'prof-super-admin',
    webAccess: true,
    isActive: true,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=RobertoCastillo',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // Docente de Matemática
  {
    _id: 'usr-tch-mat-001',
    name: 'Prof. Carlos Mendoza',
    email: 'carlos.mendoza.10482910@colegiocolombia.edu.pe',
    dni: '10482910',
    password: DEFAULT_PASSWORD_HASH,
    role: 'TEACHER',
    specialty: 'Matemática',
    profileId: 'prof-docente',
    teacherId: 'tch-mat-001',
    webAccess: true,
    isActive: true,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CarlosMendoza',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // Alumno
  {
    _id: 'usr-std-001',
    name: 'Mateo Quispe Silva',
    email: 'mateo.quispe.71000001@colegiocolombia.edu.pe',
    dni: '71000001',
    password: DEFAULT_PASSWORD_HASH,
    role: 'STUDENT',
    profileId: 'prof-alumno',
    studentId: 'std-001',
    webAccess: true,
    isActive: true,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MateoQuispe',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('═══════════════════════════════════════════════════════════');
print('✅ Inserción inicial completada con éxito en MongoDB');
print('   Contraseña por defecto para todas las cuentas: 12345678');
print('   Email de admin: alex.valdivia.00000001@colegiocolombia.edu.pe');
print('═══════════════════════════════════════════════════════════');
