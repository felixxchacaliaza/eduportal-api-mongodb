import { Schema, model } from 'mongoose';

export interface IUser {
  _id: string;
  email: string;
  password: string;
  name: string;
  dni?: string | null;
  role: string;
  cargo?: string | null;
  specialty?: string | null;
  status: string;
  appAccess: boolean;
  webAccess: boolean;
  mustChangePassword: boolean;
  avatarUrl: string;
  profileId?: string | null;
  studentId?: string | null;
  teacherId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    dni: { type: String, sparse: true, default: null },
    role: { type: String, required: true },
    cargo: { type: String, default: null },
    specialty: { type: String, default: null },
    status: { type: String, default: 'ACTIVE' },
    appAccess: { type: Boolean, default: true },
    webAccess: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    avatarUrl: { type: String, default: '' },
    profileId: { type: String, ref: 'Profile', default: null },
    studentId: { type: String, sparse: true, default: null },
    teacherId: { type: String, sparse: true, default: null }
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

UserSchema.index({ role: 1 });
UserSchema.index({ profileId: 1 });

export const User = model<IUser>('User', UserSchema);
