import mongoose from 'mongoose';

const placeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    lat: { type: Number },
    lon: { type: Number },
    time: { type: String, default: '' },
    notes: { type: String, default: '' },
    kinds: { type: String, default: '' },
    xid: { type: String, default: '' },
    instanceId: { type: String, default: '' },
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    dayIndex: { type: Number, required: true },
    items: [placeSchema],
  },
  { _id: false }
);

const budgetItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD', enum: ['USD', 'INR', 'EUR'] },
  },
  { _id: false }
);

const itinerarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    shareId: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: 'My trip' },
    days: [daySchema],
    budgetItems: [budgetItemSchema],
    allowEditViaLink: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Itinerary', itinerarySchema);
