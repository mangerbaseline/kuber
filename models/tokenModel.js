import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
    merchantId: {
        type: String,
        required: true,
        unique: true
    },
    refreshToken: {
        type: String,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

tokenSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Token', tokenSchema);