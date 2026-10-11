import { Schema, model } from 'mongoose';

export interface IProfileOption {
  optionKey: string;
  level: 'FULL' | 'READ_ONLY';
}

export interface IProfile {
  _id: string;
  name: string;
  description: string;
  icon: string;
  colorClass: string;
  isSystem: boolean;
  status: string;
  options: IProfileOption[];
  createdAt: Date;
  updatedAt: Date;
}

const ProfileOptionSchema = new Schema<IProfileOption>(
  {
    optionKey: { type: String, required: true },
    level: { type: String, enum: ['FULL', 'READ_ONLY'], default: 'FULL' }
  },
  { _id: false }
);

const ProfileSchema = new Schema<IProfile>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    icon: { type: String, default: 'shield' },
    colorClass: { type: String, default: 'prof-blue' },
    isSystem: { type: Boolean, default: false },
    status: { type: String, default: 'ACTIVE' },
    options: { type: [ProfileOptionSchema], default: [] }
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

export const Profile = model<IProfile>('Profile', ProfileSchema);
