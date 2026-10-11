import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface ISubjectTeacherHistory {
  _id: string;
  subjectId?: string;
  previousTeacher?: string | null;
  newTeacher: string;
  assignedBy: string;
  reason?: string | null;
  assignedAt: Date;
}

export interface ISubject {
  _id: string;
  code: string;
  name: string;
  category: string;
  specialty: string;
  grade: string;
  section: string;
  classroom: string;
  teacherId?: string | null;
  teacherName: string;
  weeklyHours: number;
  enrolledCount: number;
  maxCapacity: number;
  icon: string;
  color: string;
  status: string;
  teacherHistories: ISubjectTeacherHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const SubjectTeacherHistorySchema = new Schema<ISubjectTeacherHistory>(
  {
    _id: { type: String, default: () => randomUUID() },
    previousTeacher: { type: String, default: null },
    newTeacher: { type: String, required: true },
    assignedBy: { type: String, default: 'sistema' },
    reason: { type: String, default: null },
    assignedAt: { type: Date, default: Date.now }
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

const SubjectSchema = new Schema<ISubject>(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    specialty: { type: String, default: 'Matemática' },
    grade: { type: String, default: '1° Secundaria' },
    section: { type: String, default: 'A' },
    classroom: { type: String, default: 'Aula 101' },
    teacherId: { type: String, default: null },
    teacherName: { type: String, required: true },
    weeklyHours: { type: Number, required: true },
    enrolledCount: { type: Number, default: 0 },
    maxCapacity: { type: Number, default: 35 },
    icon: { type: String, default: '📚' },
    color: { type: String, default: '#2563eb' },
    status: { type: String, default: 'ACTIVE' },
    teacherHistories: { type: [SubjectTeacherHistorySchema], default: [] }
  },
  {
    collection: 'subjects',
    timestamps: true,
    _id: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        if (Array.isArray(ret.teacherHistories)) {
          ret.teacherHistories = ret.teacherHistories.map((h: any) => ({
            id: h._id || h.id,
            subjectId: ret._id,
            previousTeacher: h.previousTeacher,
            newTeacher: h.newTeacher,
            assignedBy: h.assignedBy,
            reason: h.reason,
            assignedAt: h.assignedAt
          }));
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Subject = model<ISubject>('Subject', SubjectSchema);
