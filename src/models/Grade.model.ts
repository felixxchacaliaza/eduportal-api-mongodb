import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IGrade {
  _id: string;
  studentId: string;
  subjectId: string;
  academicYearId: string;
  bimester1?: number | null;
  bimester2?: number | null;
  bimester3?: number | null;
  bimester4?: number | null;
  finalAverage: number;
  isPassing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GradeSchema = new Schema<IGrade>(
  {
    _id: { type: String, default: () => randomUUID() },
    studentId: { type: String, required: true, ref: 'Student' },
    subjectId: { type: String, required: true, ref: 'Subject' },
    academicYearId: { type: String, required: true, ref: 'AcademicYear' },
    bimester1: { type: Number, default: null },
    bimester2: { type: Number, default: null },
    bimester3: { type: Number, default: null },
    bimester4: { type: Number, default: null },
    finalAverage: { type: Number, default: 0 },
    isPassing: { type: Boolean, default: false }
  },
  {
    timestamps: true,
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

GradeSchema.index({ studentId: 1, subjectId: 1, academicYearId: 1 }, { unique: true });
GradeSchema.index({ subjectId: 1 });

export const Grade = model<IGrade>('Grade', GradeSchema);
