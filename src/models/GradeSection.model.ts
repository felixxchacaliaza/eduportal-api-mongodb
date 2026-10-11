import { Schema, model } from 'mongoose';

export interface IGradeSection {
  _id: string;
  grade: string;
  section: string;
  classroom: string;
  maxCapacity: number;
  shift: string;
  status: string;
  assignedSubjects: number;
  weeklyHours: number;
  createdAt: Date;
  updatedAt: Date;
}

const GradeSectionSchema = new Schema<IGradeSection>(
  {
    _id: { type: String, required: true },
    grade: { type: String, required: true },
    section: { type: String, required: true },
    classroom: { type: String, required: true },
    maxCapacity: { type: Number, default: 30 },
    shift: { type: String, default: 'MAÑANA' },
    status: { type: String, default: 'ACTIVE' },
    assignedSubjects: { type: Number, default: 0 },
    weeklyHours: { type: Number, default: 0 }
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

GradeSectionSchema.index({ grade: 1, section: 1 }, { unique: true });

export const GradeSection = model<IGradeSection>('GradeSection', GradeSectionSchema);
