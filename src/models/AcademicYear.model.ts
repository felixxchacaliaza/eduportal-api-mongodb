import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IBimester {
  _id: string;
  number: number;
  startsAt: Date;
  endsAt: Date;
  isOpen: boolean;
}

export interface IAcademicYear {
  _id: string;
  year: number;
  name: string;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  bimesters: IBimester[];
  createdAt: Date;
  updatedAt: Date;
}

const BimesterSchema = new Schema<IBimester>(
  {
    _id: { type: String, default: () => randomUUID() },
    number: { type: Number, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isOpen: { type: Boolean, default: false }
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

const AcademicYearSchema = new Schema<IAcademicYear>(
  {
    _id: { type: String, default: () => randomUUID() },
    year: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    bimesters: { type: [BimesterSchema], default: [] }
  },
  {
    timestamps: true,
    _id: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        if (Array.isArray(ret.bimesters)) {
          ret.bimesters = ret.bimesters.map((b: any) => ({
            id: b._id || b.id,
            academicYearId: ret._id,
            number: b.number,
            startsAt: b.startsAt,
            endsAt: b.endsAt,
            isOpen: b.isOpen
          }));
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const AcademicYear = model<IAcademicYear>('AcademicYear', AcademicYearSchema);
