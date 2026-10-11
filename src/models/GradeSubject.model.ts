import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IGradeSubject {
  _id: string;
  grade: string;
  subjectId: string;
  createdAt: Date;
}

const GradeSubjectSchema = new Schema<IGradeSubject>(
  {
    _id: { type: String, default: () => randomUUID() },
    grade: { type: String, required: true },
    subjectId: { type: String, required: true, ref: 'Subject' }
  },
  {
    collection: 'grade_subjects',
    timestamps: { createdAt: true, updatedAt: false },
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

GradeSubjectSchema.index({ grade: 1, subjectId: 1 }, { unique: true });

export const GradeSubject = model<IGradeSubject>('GradeSubject', GradeSubjectSchema);
