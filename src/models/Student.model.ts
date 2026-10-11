import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IEmergencyContact {
  _id: string;
  name: string;
  relationship: string;
  phone: string;
}

export interface IStudent {
  _id: string;
  dni: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  grade: string;
  section: string;
  status: string;
  averageGrade: number;
  attendancePercentage: number;
  avatarUrl: string;
  registeredAt: string;
  emergencyContacts: IEmergencyContact[];
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    _id: { type: String, default: () => randomUUID() },
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    phone: { type: String, required: true }
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

const StudentSchema = new Schema<IStudent>(
  {
    _id: { type: String, required: true },
    dni: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    birthDate: { type: String, required: true },
    grade: { type: String, required: true },
    section: { type: String, required: true },
    status: { type: String, default: 'ACTIVE' },
    averageGrade: { type: Number, default: 0 },
    attendancePercentage: { type: Number, default: 100 },
    avatarUrl: { type: String, default: '' },
    registeredAt: { type: String, default: () => new Date().toISOString().split('T')[0] },
    emergencyContacts: { type: [EmergencyContactSchema], default: [] }
  },
  {
    timestamps: true,
    _id: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        if (Array.isArray(ret.emergencyContacts)) {
          ret.emergencyContacts = ret.emergencyContacts.map((c: any) => ({
            id: c._id || c.id,
            studentId: ret._id,
            name: c.name,
            relationship: c.relationship,
            phone: c.phone
          }));
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

StudentSchema.index({ grade: 1, section: 1 });

export const Student = model<IStudent>('Student', StudentSchema);
