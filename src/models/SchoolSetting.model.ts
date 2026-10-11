import { Schema, model } from 'mongoose';

export interface ISchoolSetting {
  _id: string;
  value: any;
  updatedAt: Date;
}

const SchoolSettingSchema = new Schema<ISchoolSetting>(
  {
    _id: { type: String, required: true },
    value: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    _id: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.key = ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const SchoolSetting = model<ISchoolSetting>('SchoolSetting', SchoolSettingSchema);
