import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { connectDatabase, disconnectDatabase } from '../config/database';
import {
  User,
  Profile,
  Student,
  Teacher,
  Subject,
  GradeSection,
  GradeSubject,
  AcademicYear,
  Grade,
  SchoolSetting
} from '../models';
import { buildInstitutionalEmail } from '../lib/email-generator';
import { BimesterValues, PASSING_GRADE, computeFinalAverage, studentAverage } from '../lib/grading';

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || '12345678';
const ACADEMIC_YEAR = 2026;

const ALL_MODULES = [
  'dashboard', 'students', 'staff', 'grades', 'grade_sections',
  'grade_subjects', 'subjects', 'access_control', 'school_config'
];

type Level = 'FULL' | 'READ_ONLY';
const all = (level: Level) => Object.fromEntries(ALL_MODULES.map(k => [k, level])) as Record<string, Level>;

/** Perfiles del sistema */
const SYSTEM_PROFILES: {
  id: string; name: string; description: string; icon: string; colorClass: string;
  permissions: Record<string, Level>;
}[] = [
  {
    id: 'prof-super-admin', name: 'Perfil Super Usuario', icon: 'workspace_premium', colorClass: 'prof-red',
    description: 'Máximo nivel de control institucional. Acceso Total y Completo (Full) a los 9 módulos de la plataforma. (Exclusivo: 1 solo usuario en el sistema).',
    permissions: all('FULL')
  },
  {
    id: 'prof-admin', name: 'Perfil Administrador', icon: 'admin_panel_settings', colorClass: 'prof-blue',
    description: 'Control total (Full) de los 2 módulos administrativos (Accesos y Configuración Escolar) y modo consulta (Solo Lectura) en módulos pedagógicos. Sin acceso a Dashboard.',
    permissions: {
      students: 'READ_ONLY', staff: 'READ_ONLY', grades: 'READ_ONLY', grade_sections: 'READ_ONLY',
      grade_subjects: 'READ_ONLY', subjects: 'READ_ONLY', access_control: 'FULL', school_config: 'FULL'
    }
  },
  {
    id: 'prof-director', name: 'Perfil Director(a) General', icon: 'account_balance', colorClass: 'prof-purple',
    description: 'Control total (Full) pedagógico, docente y curricular de la institución, con modo consulta (Solo Lectura) en los 2 módulos administrativos.',
    permissions: { ...all('FULL'), access_control: 'READ_ONLY', school_config: 'READ_ONLY' }
  },
  {
    id: 'prof-docente', name: 'Perfil Docente de Secundaria', icon: 'school', colorClass: 'prof-green',
    description: 'Acceso al panel de indicadores (Dashboard) y gestión completa de calificaciones por competencias.',
    permissions: { dashboard: 'READ_ONLY', grades: 'FULL' }
  },
  {
    id: 'prof-alumno', name: 'Perfil Alumno / Estudiante', icon: 'backpack', colorClass: 'prof-teal',
    description: 'Acceso exclusivo al panel general de información e indicadores de la institución (Dashboard).',
    permissions: { dashboard: 'READ_ONLY' }
  },
  {
    id: 'prof-sin-acceso', name: 'Perfil Sin Acceso (Bloqueado)', icon: 'block', colorClass: 'prof-slate',
    description: 'Perfil sin opciones ni permisos asignados. El acceso a la plataforma web permanece inactivo y bloqueado.',
    permissions: {}
  }
];

const STAFF_USERS = [
  { id: 'usr-super-admin', first: 'Alex', last: 'Valdivia', name: 'Ing. Alex Valdivia', dni: '00000001', role: 'ADMIN', cargo: 'Super Usuario', profileId: 'prof-super-admin' },
  { id: 'usr-admin-ops', first: 'Marco', last: 'Polo', name: 'Lic. Marco Polo Quispe', dni: '10987654', role: 'ADMIN', cargo: 'Oficial MINEDU', profileId: 'prof-admin' },
  { id: 'usr-admin', first: 'Roberto', last: 'Castillo', name: 'Lic. Roberto Castillo', dni: '10234567', role: 'DIRECTOR', cargo: 'Director General', profileId: 'prof-director' },
  { id: 'usr-subdirector', first: 'Carmen', last: 'Benavides', name: 'Mg. Carmen Luz Benavides', dni: '10876543', role: 'SUBDIRECTOR', cargo: 'Subdirectora de Formación General', profileId: 'prof-director' },
  { id: 'usr-cp-001', first: 'Miguel', last: 'Huamán', name: 'Lic. Miguel Ángel Huamán', dni: '25410001', role: 'COORDINADOR_PEDAGOGICO', cargo: 'Coordinador Pedagógico', profileId: 'prof-docente' },
  { id: 'usr-toe-001', first: 'Patricia', last: 'Morales', name: 'Lic. Patricia Morales Díaz', dni: '25410002', role: 'COORDINADOR_TUTORIA', cargo: 'Coordinadora de Tutoría (TOE)', profileId: 'prof-docente' },
  { id: 'usr-psi-001', first: 'Andrea', last: 'Castro', name: 'Lic. Andrea Castro Vera', dni: '25410003', role: 'PSICOLOGO', cargo: 'Psicóloga Escolar', profileId: 'prof-sin-acceso' },
  { id: 'usr-aux-001', first: 'Jorge', last: 'Medina', name: 'Sr. Jorge Luis Medina', dni: '25410004', role: 'AUXILIAR_EDUCACION', cargo: 'Auxiliar de Educación', profileId: 'prof-sin-acceso' },
  { id: 'usr-adm-001', first: 'Teresa', last: 'Rojas', name: 'Sra. Teresa Rojas Paredes', dni: '25410005', role: 'ADMINISTRATIVO', cargo: 'Secretaria Académica', profileId: 'prof-admin' }
];

const TITULAR_BY_SUBJECT: Record<string, string> = {
  'cur-mat-100': 'tch-mat-001', 'cur-com-100': 'tch-com-001', 'cur-ing-100': 'tch-ing-001',
  'cur-cyt-100': 'tch-cyt-001', 'cur-soc-100': 'tch-soc-001', 'cur-dpcc-100': 'tch-dpcc-001',
  'cur-ept-100': 'tch-ept-001', 'cur-art-100': 'tch-art-001', 'cur-edf-100': 'tch-edf-001',
  'cur-rel-100': 'tch-rel-001', 'cur-toe-100': 'tch-toe-001', 'asig-mat-5a': 'tch-mat-001'
};

const REGISTERED_BIMESTERS = 3;

const FIRST_NAMES_MALE = [
  'Mateo', 'Sebastián', 'Alejandro', 'Diego', 'Gabriel', 'Joaquín', 'Lucas', 'Matías',
  'Nicolás', 'Daniel', 'Leonardo', 'Samuel', 'Benjamín', 'Thiago', 'Rodrigo', 'Álvaro',
  'Facundo', 'Ignacio', 'Franco', 'Fabricio', 'Gonzalo', 'Renato', 'Manuel', 'Emilio', 'Eduardo'
];

const FIRST_NAMES_FEMALE = [
  'Valeria', 'Camila', 'Luciana', 'Sofía', 'Valentina', 'Mía', 'Isabella', 'Emma',
  'Martina', 'Victoria', 'Emily', 'Antonella', 'Zoe', 'Renata', 'Abril', 'Jimena',
  'Ariana', 'Daniela', 'Fernanda', 'Andrea', 'Natalia', 'Mariana', 'Paola', 'Lorena', 'Romina'
];

const LAST_NAMES = [
  'Quispe', 'Flores', 'Sánchez', 'García', 'Rodríguez', 'Rojas', 'Díaz', 'Torres',
  'López', 'Gonzales', 'Pérez', 'Chávez', 'Vásquez', 'Ramos', 'Morales', 'Castillo',
  'Gutiérrez', 'Castro', 'Fernández', 'Romero', 'Navarro', 'Reyes', 'Mendoza', 'Alarcón',
  'Salazar', 'Vargas', 'Silva', 'Espinoza', 'Huamán', 'Herrera', 'Medina', 'Paredes',
  'Campos', 'Cordero', 'Carrasco', 'Aguilar', 'Benítez', 'Valdivia', 'Cárdenas', 'Guzmán'
];

const CLASSROOMS = [
  { grade: '1° Secundaria', section: 'A', room: 'Aula 101', birthYear: 2013 },
  { grade: '1° Secundaria', section: 'B', room: 'Aula 102', birthYear: 2013 },
  { grade: '2° Secundaria', section: 'A', room: 'Aula 201', birthYear: 2012 },
  { grade: '2° Secundaria', section: 'B', room: 'Aula 202', birthYear: 2012 },
  { grade: '3° Secundaria', section: 'A', room: 'Aula 301', birthYear: 2011 },
  { grade: '3° Secundaria', section: 'B', room: 'Aula 302', birthYear: 2011 },
  { grade: '4° Secundaria', section: 'A', room: 'Aula 401', birthYear: 2010 },
  { grade: '4° Secundaria', section: 'B', room: 'Aula 402', birthYear: 2010 },
  { grade: '5° Secundaria', section: 'A', room: 'Aula 501', birthYear: 2009 },
  { grade: '5° Secundaria', section: 'B', room: 'Aula 502', birthYear: 2009 },
];

const MINEDU_OFFICIAL_COURSES = [
  { id: 'cur-mat-100', code: 'MAT-100', name: 'Matemática', category: 'CIENCIAS', specialty: 'Matemática', hours: 5, icon: '📐', color: '#2563eb', teacher: 'Prof. Carlos Mendoza' },
  { id: 'cur-com-100', code: 'COM-100', name: 'Comunicación', category: 'HUMANIDADES', specialty: 'Comunicación', hours: 5, icon: '📖', color: '#059669', teacher: 'Prof. Ana María Velásquez' },
  { id: 'cur-ing-100', code: 'ING-100', name: 'Inglés', category: 'IDIOMAS', specialty: 'Idiomas', hours: 3, icon: '🌍', color: '#7c3aed', teacher: 'Prof. John Smith' },
  { id: 'cur-cyt-100', code: 'CYT-100', name: 'Ciencia y Tecnología', category: 'CIENCIAS', specialty: 'Ciencias Naturales', hours: 4, icon: '🧪', color: '#0284c7', teacher: 'Prof. Elena Morales' },
  { id: 'cur-soc-100', code: 'SOC-100', name: 'Ciencias Sociales', category: 'HUMANIDADES', specialty: 'Ciencias Sociales', hours: 3, icon: '🏛️', color: '#d97706', teacher: 'Prof. Patricia Flores' },
  { id: 'cur-dpcc-100', code: 'DPCC-100', name: 'Desarrollo Personal, Ciudadanía y Cívica', category: 'HUMANIDADES', specialty: 'Humanidades', hours: 3, icon: '⚖️', color: '#4f46e5', teacher: 'Prof. Gabriel Vargas' },
  { id: 'cur-ept-100', code: 'EPT-100', name: 'Educación para el Trabajo', category: 'TECNOLOGÍA', specialty: 'Tecnología', hours: 2, icon: '💻', color: '#0891b2', teacher: 'Prof. Roberto Paredes' },
  { id: 'cur-art-100', code: 'ART-100', name: 'Arte y Cultura', category: 'ARTES', specialty: 'Artes', hours: 3, icon: '🎨', color: '#db2777', teacher: 'Prof. Rosa Chávez' },
  { id: 'cur-edf-100', code: 'EDF-100', name: 'Educación Física', category: 'CIENCIAS', specialty: 'Educación Física', hours: 3, icon: '⚽', color: '#16a34a', teacher: 'Prof. Javier Morales' },
  { id: 'cur-rel-100', code: 'REL-100', name: 'Educación Religiosa', category: 'HUMANIDADES', specialty: 'Religión', hours: 2, icon: '🕊️', color: '#e11d48', teacher: 'Prof. Silvia Ramos' },
  { id: 'cur-toe-100', code: 'TOE-100', name: 'Tutoría y Orientación Educativa', category: 'HUMANIDADES', specialty: 'Tutoría', hours: 2, icon: '🧭', color: '#ea580c', teacher: 'Prof. Manuel Espinoza' },
  { id: 'asig-mat-5a', code: 'MAT-501', name: 'Álgebra y Trigonometría', category: 'CIENCIAS', specialty: 'Matemática', hours: 4, icon: '📐', color: '#1d4ed8', teacher: 'Prof. Carlos Mendoza' }
];

export async function seedData(autoDisconnect = false) {
  console.log('🌱 Iniciando carga de datos en MongoDB...');

  // 1. Limpieza de colecciones
  console.log('🧹 Limpiando colecciones anteriores en MongoDB...');
  await Promise.all([
    Grade.deleteMany({}),
    User.deleteMany({}),
    Student.deleteMany({}),
    Teacher.deleteMany({}),
    GradeSubject.deleteMany({}),
    Subject.deleteMany({}),
    GradeSection.deleteMany({}),
    AcademicYear.deleteMany({}),
    Profile.deleteMany({}),
    SchoolSetting.deleteMany({})
  ]);

  // Sincronizar índices y limpiar índices obsoletos (como studentId_1_asignaturaId_1_academicYearId_1)
  await Grade.collection.dropIndexes().catch(() => {});
  await mongoose.connection.syncIndexes();

  const defaultPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // 1.1 Perfiles de acceso
  console.log('🔐 Registrando perfiles y matriz de permisos...');
  for (const p of SYSTEM_PROFILES) {
    await Profile.create({
      _id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      colorClass: p.colorClass,
      isSystem: true,
      options: Object.entries(p.permissions).map(([optionKey, level]) => ({ optionKey, level }))
    });
  }

  // 1.2 Año lectivo activo con sus 4 bimestres
  console.log(`📅 Registrando año lectivo ${ACADEMIC_YEAR} con 4 bimestres...`);
  const academicYear = await AcademicYear.create({
    _id: `ay-${ACADEMIC_YEAR}`,
    year: ACADEMIC_YEAR,
    name: `Año Escolar ${ACADEMIC_YEAR}`,
    startsAt: new Date(`${ACADEMIC_YEAR}-03-09`),
    endsAt: new Date(`${ACADEMIC_YEAR}-12-19`),
    isActive: true,
    bimesters: [
      { _id: `bim-1-${ACADEMIC_YEAR}`, number: 1, startsAt: new Date(`${ACADEMIC_YEAR}-03-09`), endsAt: new Date(`${ACADEMIC_YEAR}-05-15`), isOpen: false },
      { _id: `bim-2-${ACADEMIC_YEAR}`, number: 2, startsAt: new Date(`${ACADEMIC_YEAR}-05-25`), endsAt: new Date(`${ACADEMIC_YEAR}-07-31`), isOpen: false },
      { _id: `bim-3-${ACADEMIC_YEAR}`, number: 3, startsAt: new Date(`${ACADEMIC_YEAR}-08-10`), endsAt: new Date(`${ACADEMIC_YEAR}-10-16`), isOpen: true },
      { _id: `bim-4-${ACADEMIC_YEAR}`, number: 4, startsAt: new Date(`${ACADEMIC_YEAR}-10-26`), endsAt: new Date(`${ACADEMIC_YEAR}-12-19`), isOpen: false }
    ]
  });

  // 1.3 Secciones
  console.log('🏫 Registrando las 10 secciones de secundaria...');
  for (const c of CLASSROOMS) {
    await GradeSection.create({
      _id: `sec-${c.grade[0]}-${c.section.toLowerCase()}`,
      grade: c.grade,
      section: c.section,
      classroom: c.room,
      maxCapacity: 30,
      shift: 'MAÑANA',
      status: 'ACTIVE',
      assignedSubjects: MINEDU_OFFICIAL_COURSES.length,
      weeklyHours: MINEDU_OFFICIAL_COURSES.reduce((sum, x) => sum + x.hours, 0)
    });
  }

  // 2. Crear las 11 Asignaturas/Subjects Oficiales del MINEDU
  console.log('📚 Registrando las Asignaturas/Subjects Oficiales del MINEDU...');
  const createdSubjects: any[] = [];
  for (const c of MINEDU_OFFICIAL_COURSES) {
    const asig = await Subject.create({
      _id: c.id,
      code: c.code,
      name: c.name,
      category: c.category,
      specialty: c.specialty,
      grade: 'Secundaria (1° a 5°)',
      section: 'Común',
      classroom: 'Aula Oficial',
      teacherName: c.teacher,
      weeklyHours: c.hours,
      enrolledCount: 100,
      maxCapacity: 120,
      icon: c.icon,
      color: c.color,
      status: 'ACTIVE',
      teacherHistories: [
        {
          _id: randomUUID(),
          previousTeacher: null,
          newTeacher: c.teacher,
          assignedBy: 'Lic. Roberto Castillo (Director)',
          reason: 'Asignación inaugural de cátedra (CNEB)',
          assignedAt: new Date()
        }
      ]
    });
    createdSubjects.push(asig);
  }

  // 2.1 Asignar las asignaturas a la malla de los 5 grados de secundaria
  const SECONDARY_GRADES = [
    '1° Secundaria',
    '2° Secundaria',
    '3° Secundaria',
    '4° Secundaria',
    '5° Secundaria'
  ];
  for (const grade of SECONDARY_GRADES) {
    for (const c of createdSubjects) {
      await GradeSubject.create({
        _id: randomUUID(),
        grade,
        subjectId: c._id
      });
    }
  }

  // 3. Crear 100 Estudiantes distribuidos equitativamente
  console.log('👨‍🎓 Generando 100 estudiantes distribuidos en 10 aulas...');
  const usersToCreate: any[] = [];
  let globalStudentCounter = 1;

  for (let cIdx = 0; cIdx < CLASSROOMS.length; cIdx++) {
    const cls = CLASSROOMS[cIdx];

    for (let sIdx = 0; sIdx < 10; sIdx++) {
      const isFemale = sIdx % 2 === 1;
      const fList = isFemale ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE;
      const firstName = fList[(cIdx * 2 + sIdx) % fList.length];
      const lastName = `${LAST_NAMES[(cIdx * 3 + sIdx) % LAST_NAMES.length]} ${LAST_NAMES[(cIdx * 5 + sIdx + 7) % LAST_NAMES.length]}`;
      const studentId = `std-${String(globalStudentCounter).padStart(3, '0')}`;
      const dni = String(71000000 + globalStudentCounter);
      const email = buildInstitutionalEmail(firstName, lastName, dni);
      const phone = `9${Math.floor(10000000 + Math.random() * 89999999)}`;
      const birthMonth = String((sIdx % 12) + 1).padStart(2, '0');
      const birthDay = String(((sIdx * 2) % 28) + 1).padStart(2, '0');
      const birthDate = `${cls.birthYear}-${birthMonth}-${birthDay}`;

      let p1 = 14 + (globalStudentCounter % 6);
      let p2 = 13 + ((globalStudentCounter * 3) % 7);
      let p3 = 14 + ((globalStudentCounter * 7) % 6);
      let p4 = 15 + (globalStudentCounter % 5);

      if (studentId === 'std-001') {
        p1 = 19; p2 = 18; p3 = 19; p4 = 18;
      } else if (studentId === 'std-002') {
        p1 = 20; p2 = 19; p3 = 19; p4 = 20;
      } else if (globalStudentCounter % 15 === 0) {
        p1 = 10; p2 = 11; p3 = 10; p4 = 12;
      } else if (globalStudentCounter % 27 === 0) {
        p1 = 8; p2 = 9; p3 = 9; p4 = 11;
      }

      const attendance = 85 + (globalStudentCounter % 16);
      const apoderadoLastName = lastName.split(' ')[0];
      const apoderadoName = `${isFemale ? 'Carlos' : 'Rosa'} ${apoderadoLastName}`;

      const student = await Student.create({
        _id: studentId,
        dni,
        firstName,
        lastName,
        email,
        phone,
        birthDate,
        grade: cls.grade,
        section: cls.section,
        status: 'ACTIVE',
        averageGrade: 0,
        attendancePercentage: attendance,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}_${globalStudentCounter}`,
        registeredAt: '2026-02-15',
        emergencyContacts: [
          {
            _id: randomUUID(),
            name: `${apoderadoName} (Apoderado)`,
            relationship: isFemale ? 'Padre' : 'Madre',
            phone: `9${Math.floor(10000000 + Math.random() * 89999999)}`
          }
        ]
      });

      usersToCreate.push({
        _id: `usr-${studentId}`,
        name: `${firstName} ${lastName}`,
        email,
        dni,
        password: defaultPassword,
        role: 'STUDENT',
        profileId: 'prof-alumno',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}_${globalStudentCounter}`,
        studentId
      });

      const studentGrades: (BimesterValues & { finalAverage: number })[] = [];
      for (const crs of createdSubjects) {
        const clamp = (n: number) => Math.max(0, Math.min(20, n));
        const all = [
          clamp(p1 + ((crs._id.charCodeAt(5) % 3) - 1)),
          clamp(p2 + ((crs._id.charCodeAt(6) % 3) - 1)),
          clamp(p3 + ((crs._id.charCodeAt(7) % 3) - 1)),
          clamp(p4)
        ];
        const bimesters: BimesterValues = {
          bimester1: REGISTERED_BIMESTERS >= 1 ? all[0] : null,
          bimester2: REGISTERED_BIMESTERS >= 2 ? all[1] : null,
          bimester3: REGISTERED_BIMESTERS >= 3 ? all[2] : null,
          bimester4: REGISTERED_BIMESTERS >= 4 ? all[3] : null
        };
        const finalAverage = computeFinalAverage(bimesters);
        studentGrades.push({ ...bimesters, finalAverage });

        await Grade.create({
          _id: randomUUID(),
          studentId,
          subjectId: crs._id,
          academicYearId: academicYear._id,
          ...bimesters,
          finalAverage,
          isPassing: finalAverage >= PASSING_GRADE
        });
      }

      student.averageGrade = studentAverage(studentGrades);
      await student.save();

      globalStudentCounter++;
    }
  }

  // 4. Crear Plana Docente Oficial y Asignaciones de Aulas
  console.log('👨‍🏫 Registrando Plana Docente Oficial con Jornada MINEDU...');

  const SEED_TEACHERS = [
    {
      id: 'tch-mat-001', dni: '43210001', firstName: 'Carlos', lastName: 'Mendoza Quispe',
      fullName: 'Prof. Carlos Mendoza Quispe', email: 'carlosmendoza_43210001@colegio.edu.pe',
      phone: '987 001 001', specialty: 'CIENCIAS', subjects: ['Matemática'],
      contractedHours: 30, assignedHours: 25, sections: CLASSROOMS.slice(0, 5),
      subjectId: 'cur-mat-100', subjectName: 'Matemática', weeklyHours: 5
    },
    {
      id: 'tch-mat-002', dni: '43210002', firstName: 'Manuel', lastName: 'Espinoza Torres',
      fullName: 'Prof. Manuel Espinoza Torres', email: 'manuelespinoza_43210002@colegio.edu.pe',
      phone: '987 001 002', specialty: 'CIENCIAS', subjects: ['Matemática'],
      contractedHours: 30, assignedHours: 25, sections: CLASSROOMS.slice(5, 10),
      subjectId: 'cur-mat-100', subjectName: 'Matemática', weeklyHours: 5
    },
    {
      id: 'tch-cyt-001', dni: '43210006', firstName: 'Elena', lastName: 'Morales Salas',
      fullName: 'Prof. Elena Morales Salas', email: 'elenamorales_43210006@colegio.edu.pe',
      phone: '987 001 006', specialty: 'CIENCIAS', subjects: ['Ciencia y Tecnología'],
      contractedHours: 30, assignedHours: 24, sections: CLASSROOMS.slice(0, 6),
      subjectId: 'cur-cyt-100', subjectName: 'Ciencia y Tecnología', weeklyHours: 4
    },
    {
      id: 'tch-cyt-002', dni: '43210007', firstName: 'Ricardo', lastName: 'Alvarado Cruz',
      fullName: 'Prof. Ricardo Alvarado Cruz', email: 'ricardoalvarado_43210007@colegio.edu.pe',
      phone: '987 001 007', specialty: 'CIENCIAS', subjects: ['Ciencia y Tecnología', 'Matemática'],
      contractedHours: 30, assignedHours: 16, sections: CLASSROOMS.slice(6, 10),
      subjectId: 'cur-cyt-100', subjectName: 'Ciencia y Tecnología', weeklyHours: 4
    },
    {
      id: 'tch-edf-001', dni: '43210012', firstName: 'Javier', lastName: 'Morales Tapia',
      fullName: 'Prof. Javier Morales Tapia', email: 'javiermorales_43210012@colegio.edu.pe',
      phone: '987 001 012', specialty: 'CIENCIAS', subjects: ['Educación Física'],
      contractedHours: 30, assignedHours: 30, sections: CLASSROOMS,
      subjectId: 'cur-edf-100', subjectName: 'Educación Física', weeklyHours: 3
    },
    {
      id: 'tch-com-001', dni: '43210003', firstName: 'Ana María', lastName: 'Velásquez Huanca',
      fullName: 'Prof. Ana María Velásquez Huanca', email: 'anavelasquez_43210003@colegio.edu.pe',
      phone: '987 001 003', specialty: 'HUMANIDADES', subjects: ['Comunicación'],
      contractedHours: 30, assignedHours: 25, sections: CLASSROOMS.slice(0, 5),
      subjectId: 'cur-com-100', subjectName: 'Comunicación', weeklyHours: 5
    },
    {
      id: 'tch-com-002', dni: '43210004', firstName: 'Patricia', lastName: 'Flores Condori',
      fullName: 'Prof. Patricia Flores Condori', email: 'patriciaflores_43210004@colegio.edu.pe',
      phone: '987 001 004', specialty: 'HUMANIDADES', subjects: ['Comunicación', 'Ciencias Sociales'],
      contractedHours: 30, assignedHours: 25, sections: CLASSROOMS.slice(5, 10),
      subjectId: 'cur-com-100', subjectName: 'Comunicación', weeklyHours: 5
    },
    {
      id: 'tch-soc-001', dni: '43210008', firstName: 'Gabriel', lastName: 'Vargas Mamani',
      fullName: 'Prof. Gabriel Vargas Mamani', email: 'gabrielvargas_43210008@colegio.edu.pe',
      phone: '987 001 008', specialty: 'HUMANIDADES', subjects: ['Ciencias Sociales', 'Desarrollo Personal, Ciudadanía y Cívica'],
      contractedHours: 30, assignedHours: 30, sections: CLASSROOMS,
      subjectId: 'cur-soc-100', subjectName: 'Ciencias Sociales', weeklyHours: 3
    },
    {
      id: 'tch-dpcc-001', dni: '43210009', firstName: 'Lucía', lastName: 'Ríos Pacheco',
      fullName: 'Prof. Lucía Ríos Pacheco', email: 'luciarios_43210009@colegio.edu.pe',
      phone: '987 001 009', specialty: 'HUMANIDADES', subjects: ['Desarrollo Personal, Ciudadanía y Cívica'],
      contractedHours: 30, assignedHours: 30, sections: CLASSROOMS,
      subjectId: 'cur-dpcc-100', subjectName: 'Desarrollo Personal, Ciudadanía y Cívica', weeklyHours: 3
    },
    {
      id: 'tch-rel-001', dni: '43210013', firstName: 'Silvia', lastName: 'Ramos Soto',
      fullName: 'Prof. Silvia Ramos Soto', email: 'silviaramos_43210013@colegio.edu.pe',
      phone: '987 001 013', specialty: 'HUMANIDADES', subjects: ['Educación Religiosa'],
      contractedHours: 30, assignedHours: 20, sections: CLASSROOMS,
      subjectId: 'cur-rel-100', subjectName: 'Educación Religiosa', weeklyHours: 2
    },
    {
      id: 'tch-toe-001', dni: '43210014', firstName: 'Diana', lastName: 'Salazar Vega',
      fullName: 'Prof. Diana Salazar Vega', email: 'dianasalazar_43210014@colegio.edu.pe',
      phone: '987 001 014', specialty: 'HUMANIDADES', subjects: ['Tutoría y Orientación Educativa'],
      contractedHours: 30, assignedHours: 20, sections: CLASSROOMS,
      subjectId: 'cur-toe-100', subjectName: 'Tutoría y Orientación Educativa', weeklyHours: 2
    },
    {
      id: 'tch-ing-001', dni: '43210005', firstName: 'John', lastName: 'Smith Paredes',
      fullName: 'Prof. John Smith Paredes', email: 'johnsmith_43210005@colegio.edu.pe',
      phone: '987 001 005', specialty: 'IDIOMAS', subjects: ['Inglés'],
      contractedHours: 30, assignedHours: 30, sections: CLASSROOMS,
      subjectId: 'cur-ing-100', subjectName: 'Inglés', weeklyHours: 3
    },
    {
      id: 'tch-ept-001', dni: '43210010', firstName: 'Roberto', lastName: 'Paredes Hurtado',
      fullName: 'Prof. Roberto Paredes Hurtado', email: 'robertoparedes_43210010@colegio.edu.pe',
      phone: '987 001 010', specialty: 'TECNOLOGÍA', subjects: ['Educación para el Trabajo'],
      contractedHours: 30, assignedHours: 20, sections: CLASSROOMS,
      subjectId: 'cur-ept-100', subjectName: 'Educación para el Trabajo', weeklyHours: 2
    },
    {
      id: 'tch-art-001', dni: '43210011', firstName: 'Rosa', lastName: 'Chávez Llanos',
      fullName: 'Prof. Rosa Chávez Llanos', email: 'rosachavez_43210011@colegio.edu.pe',
      phone: '987 001 011', specialty: 'ARTES', subjects: ['Arte y Cultura'],
      contractedHours: 30, assignedHours: 30, sections: CLASSROOMS,
      subjectId: 'cur-art-100', subjectName: 'Arte y Cultura', weeklyHours: 3
    }
  ];

  for (const t of SEED_TEACHERS) {
    t.email = buildInstitutionalEmail(t.firstName, t.lastName, t.dni);
    await Teacher.create({
      _id: t.id,
      dni: t.dni,
      firstName: t.firstName,
      lastName: t.lastName,
      fullName: t.fullName,
      email: t.email,
      phone: t.phone,
      specialty: t.specialty,
      subjects: JSON.stringify(t.subjects),
      level: 'SECUNDARIA',
      contractedHours: t.contractedHours,
      assignedHours: t.assignedHours,
      status: 'ACTIVE',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(t.firstName + t.lastName)}`,
      assignments: t.sections.map(s => ({
        _id: randomUUID(),
        grade: s.grade,
        section: s.section,
        subjectId: t.subjectId,
        subjectName: t.subjectName,
        weeklyHours: t.weeklyHours,
        createdAt: new Date()
      }))
    });

    usersToCreate.push({
      _id: `usr-${t.id}`,
      name: t.fullName,
      email: t.email,
      dni: t.dni,
      password: defaultPassword,
      role: 'TEACHER',
      specialty: t.specialty,
      profileId: 'prof-docente',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(t.firstName + t.lastName)}`,
      teacherId: t.id
    });
  }

  // Actualizar docentes titulares en subjects
  for (const [subjectId, teacherId] of Object.entries(TITULAR_BY_SUBJECT)) {
    const teacher = SEED_TEACHERS.find(t => t.id === teacherId);
    if (teacher) {
      await Subject.findByIdAndUpdate(subjectId, {
        teacherId,
        teacherName: teacher.fullName
      });
    }
  }

  // 5. Crear Usuarios Institucionales de Personal
  console.log('👤 Creando usuarios institucionales (personal y docentes)...');
  for (const u of STAFF_USERS) {
    usersToCreate.push({
      _id: u.id,
      name: u.name,
      email: buildInstitutionalEmail(u.first, u.last, u.dni),
      dni: u.dni,
      password: defaultPassword,
      role: u.role,
      cargo: u.cargo,
      profileId: u.profileId,
      webAccess: u.profileId !== 'prof-sin-acceso',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.name)}`
    });
  }

  for (const u of usersToCreate) {
    await User.create(u);
  }

  // 6. Configuración institucional inicial
  await SchoolSetting.create({
    _id: 'school',
    value: {
      institutionName: 'I.E. República del Perú',
      codeModular: '0342512',
      dre: 'DRE Lima Metropolitana',
      ugel: 'UGEL 03',
      level: 'Secundaria de Menores',
      address: 'Av. Brasil 1250, Jesús María, Lima',
      phone: '(01) 424-8900',
      email: 'contacto@colegio.edu.pe',
      director: 'Lic. Roberto Castillo'
    }
  });

  const finalGradesCount = await Grade.countDocuments();
  const finalTeachersCount = await Teacher.countDocuments();
  const finalStudentsCount = await Student.countDocuments();
  const finalUsersCount = await User.countDocuments();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Base de datos MongoDB cargada exitosamente:');
  console.log(`   - 11 Cursos Oficiales de la Malla Curricular Secundaria (CNEB - MINEDU)`);
  console.log(`   - 10 Secciones escolares creadas`);
  console.log(`   - ${finalStudentsCount} Estudiantes matriculados`);
  console.log(`   - ${finalGradesCount} Calificaciones registradas`);
  console.log(`   - ${finalTeachersCount} Docentes con jornada y asignaciones`);
  console.log(`   - ${finalUsersCount} Cuentas de Usuario listas para autenticación`);
  console.log('═══════════════════════════════════════════════════════════');

  if (autoDisconnect) {
    await disconnectDatabase();
  }
}

// Ejecución directa por CLI
const isDirectCall = !process.argv[1]?.includes('server');
if (isDirectCall) {
  connectDatabase()
    .then(() => seedData(true))
    .catch(e => {
      console.error('❌ Error en el seed de MongoDB:', e);
      process.exit(1);
    });
}

