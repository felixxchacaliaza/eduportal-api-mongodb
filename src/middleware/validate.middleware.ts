import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny, z } from 'zod';

/** Valida body/query/params con Zod y deja el resultado tipado y saneado en req.body. */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Datos inválidos.',
        errors: formatZod(parsed.error)
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

function formatZod(error: ZodError): { field: string; message: string }[] {
  return error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
}

/** Nota vigesimal: número 0-20 o null (sin registrar). */
const score = z.union([z.null(), z.coerce.number().finite().min(0, 'La nota mínima es 0').max(20, 'La nota máxima es 20')]);

const dni = z.string().trim().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos');

export const AREAS_CURRICULARES = ['CIENCIAS', 'HUMANIDADES', 'TECNOLOGÍA', 'ARTES', 'IDIOMAS'] as const;
const area = z.string().trim().toUpperCase().pipe(z.enum(AREAS_CURRICULARES));

const teacherAssignment = z.object({
  grade: z.string().trim().min(1).max(30),
  section: z.string().trim().toUpperCase().min(1).max(5),
  subjectId: z.string().trim().max(80).optional(),
  subjectName: z.string().trim().min(1).max(120),
  weeklyHours: z.coerce.number().int().min(1).max(10)
});

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido (formato #RRGGBB)');

export const schemas = {
  login: z.object({
    email: z.string().trim().toLowerCase().email('Correo inválido').max(120),
    password: z.string().min(1, 'La contraseña es obligatoria').max(128)
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres').max(128)
  }),

  /** value: nota 0-20, o null para borrar la nota del bimestre (vuelve a "sin registrar"). */
  gradeUpdate: z.object({
    field: z.enum(['bimester1', 'bimester2', 'bimester3', 'bimester4']),
    value: score
  }),

  gradeBatchUpdate: z.object({
    subjectId: z.string().trim().min(1, 'El subjectId es requerido'),
    academicYearId: z.string().trim().optional(),
    bimester: z.coerce.number().int().min(1).max(4),
    grades: z
      .array(
        z.object({
          studentId: z.string().trim().min(1),
          score
        })
      )
      .min(1)
      .max(500)
  }),

  staffUser: z.object({
    name: z.string().trim().min(3).max(120),
    dni,
    role: z.string().trim().toUpperCase(),
    cargo: z.string().trim().max(160).optional(),
    specialty: z.string().trim().max(80).optional(),
    password: z.string().min(8).max(128).optional(),
    profileId: z.string().trim().optional(),
    appAccess: z.boolean().optional(),
    webAccess: z.boolean().optional()
  }),

  assignProfile: z.object({
    profileId: z.string().trim().min(1)
  }),

  profile: z.object({
    name: z.string().trim().min(3).max(80),
    description: z.string().trim().max(400).default(''),
    icon: z.string().trim().max(40).optional(),
    colorClass: z.string().trim().max(40).optional(),
    options: z.array(z.string().trim().min(1)).default([]),
    permissions: z.record(z.string(), z.enum(['FULL', 'READ_ONLY'])).default({})
  }),

  academicYear: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    name: z.string().trim().min(3).max(80),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    isActive: z.boolean().optional(),
    bimesters: z
      .array(
        z.object({
          number: z.coerce.number().int().min(1).max(4),
          startsAt: z.coerce.date(),
          endsAt: z.coerce.date(),
          isOpen: z.boolean().default(false)
        })
      )
      .max(4)
      .optional()
  }),

  userAccess: z.object({
    appAccess: z.boolean().optional(),
    webAccess: z.boolean().optional()
  }),

  resetPassword: z.object({
    password: z.string().min(8, 'Mínimo 8 caracteres').max(128).optional()
  }),

  student: z
    .object({
      dni: z.string().trim().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos'),
      firstName: z.string().trim().min(2).max(80),
      lastName: z.string().trim().min(2).max(80),
      phone: z.string().trim().max(20).optional(),
      birthDate: z.string().trim().min(8).max(10),
      grade: z.string().trim().min(1).max(30),
      section: z.string().trim().min(1).max(5),
      status: z.enum(['ACTIVE', 'PENDING', 'INACTIVE', 'GRADUATED']).optional(),
      attendancePercentage: z.coerce.number().min(0).max(100).optional(),
      avatarUrl: z.string().trim().max(300).optional(),
      registeredAt: z.string().trim().max(10).optional(),
      emergencyContacts: z
        .array(z.object({ name: z.string().trim().min(1).max(120), relationship: z.string().trim().max(40), phone: z.string().trim().max(20) }))
        .max(5)
        .optional()
    })
    .passthrough(),

  studentUpdate: z
    .object({
      dni: z.string().trim().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos').optional(),
      firstName: z.string().trim().min(2).max(80).optional(),
      lastName: z.string().trim().min(2).max(80).optional(),
      phone: z.string().trim().max(20).optional(),
      birthDate: z.string().trim().max(10).optional(),
      grade: z.string().trim().max(30).optional(),
      section: z.string().trim().max(5).optional(),
      status: z.enum(['ACTIVE', 'PENDING', 'INACTIVE', 'GRADUATED']).optional(),
      attendancePercentage: z.coerce.number().min(0).max(100).optional(),
      emergencyContacts: z
        .array(z.object({ name: z.string().trim().min(1).max(120), relationship: z.string().trim().max(40), phone: z.string().trim().max(20) }))
        .max(5)
        .optional()
    })
    .passthrough(),

  settingValue: z.record(z.string(), z.any()),

  // ─── Docentes ───────────────────────────────────────────────
  teacherCreate: z.object({
    dni,
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(20).optional(),
    specialty: area,
    subjects: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
    contractedHours: z.coerce.number().int().min(1).max(40).default(30),
    assignments: z.array(teacherAssignment).max(80).default([])
  }),

  teacherUpdate: z.object({
    firstName: z.string().trim().min(2).max(80).optional(),
    lastName: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(20).optional(),
    specialty: area.optional(),
    subjects: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
    contractedHours: z.coerce.number().int().min(1).max(40).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LICENSED']).optional(),
    assignments: z.array(teacherAssignment).max(80).optional()
  }),

  // ─── Cursos / Subjects ───────────────────────────────────────
  subjectCreate: z.object({
    code: z.string().trim().toUpperCase().min(2).max(20),
    name: z.string().trim().min(2).max(120),
    category: area.default('CIENCIAS'),
    specialty: z.string().trim().max(60).optional(),
    grade: z.string().trim().max(40).optional(),
    section: z.string().trim().max(20).optional(),
    classroom: z.string().trim().max(40).optional(),
    teacherName: z.string().trim().max(160).optional(),
    weeklyHours: z.coerce.number().int().min(1).max(10).optional(),
    maxCapacity: z.coerce.number().int().min(1).max(500).optional(),
    icon: z.string().trim().max(16).optional(),
    color: hexColor.optional()
  }),

  subjectUpdate: z.object({
    code: z.string().trim().toUpperCase().min(2).max(20).optional(),
    name: z.string().trim().min(2).max(120).optional(),
    category: area.optional(),
    specialty: z.string().trim().max(60).optional(),
    weeklyHours: z.coerce.number().int().min(1).max(10).optional(),
    icon: z.string().trim().max(16).optional(),
    color: hexColor.optional()
  }),

  assignTeacher: z.object({
    teacherName: z.string().trim().min(3, 'Debe indicar el nombre del nuevo docente titular.').max(160),
    reason: z.string().trim().max(300).optional()
  }),

  // ─── Grados y secciones ─────────────────────────────────────
  gradeSectionCreate: z.object({
    grade: z.string().trim().min(1).max(30),
    section: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}$/, 'La sección debe ser una letra (A, B, C...)'),
    classroom: z.string().trim().min(1).max(40),
    maxCapacity: z.coerce.number().int().min(1).max(60).default(30),
    shift: z.string().trim().toUpperCase().max(20).optional()
  }),

  gradeSectionUpdate: z.object({
    classroom: z.string().trim().min(1).max(40).optional(),
    maxCapacity: z.coerce.number().int().min(1).max(60).optional(),
    shift: z.string().trim().toUpperCase().max(20).optional()
  }),

  gradeCourses: z.object({
    subjectIds: z.array(z.string().trim().min(1)).min(1).max(40)
  })
};
