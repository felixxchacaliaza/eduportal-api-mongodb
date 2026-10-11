import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface ITeacherAssignment {
  _id: string;
  teacherId?: string;
  grade: string;
  section: string;
  subjectId: string;
  subjectName: string;
  weeklyHours: number;
  createdAt: Date;
}

export interface ITeacher {
  _id: string;
  dni: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  specialty: string;
  subjects: string;
  level: string;
  contractedHours: number;
  assignedHours: number;
  status: string;
  avatarUrl?: string | null;
  assignments: ITeacherAssignment[];
  createdAt: Date;
  updatedAt: Date;
}

const TeacherAssignmentSchema = new Schema<ITeacherAssignment>(
  {
    _id: { type: String, default: () => randomUUID() },
    grade: { type: String, required: true },
    section: { type: String, required: true },
    subjectId: { type: String, required: true },
    subjectName: { type: String, required: true },
    weeklyHours: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  {
    _id: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

const TeacherSchema = new Schema<ITeacher>(
  {
    _id: { type: String, required: true },
    dni: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    specialty: { type: String, required: true },
    subjects: { type: String, default: '[]' },
    level: { type: String, default: 'SECUNDARIA' },
    contractedHours: { type: Number, default: 30 },
    assignedHours: { type: Number, default: 0 },
    status: { type: String, default: 'ACTIVE' },
    avatarUrl: { type: String, default: null },
    assignments: { type: [TeacherAssignmentSchema], default: [] }
  },
  {
    timestamps: true,
    _id: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        if (Array.isArray(ret.assignments)) {
          ret.assignments = ret.assignments.map((a: any) => ({
            id: a._id || a.id,
            teacherId: ret._id,
            grade: a.grade,
            section: a.section,
            subjectId: a.subjectId,
            subjectName: a.subjectName,
            weeklyHours: a.weeklyHours,
            createdAt: a.createdAt
          }));
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Teacher = model<ITeacher>('Teacher', TeacherSchema);
