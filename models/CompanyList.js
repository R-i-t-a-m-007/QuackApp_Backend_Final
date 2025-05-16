import mongoose from 'mongoose';

const companyListSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  country: { type: String, required: true },
  city: { type: String, required: true },
  postcode: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User ' }, // Reference to the user who added this company
  password: { type: String, required: true }, // Add password field
  comp_code: { type: String, required: true }, // Add company code field
  image: { type: String, default: null }, // Field to store the company image
  resetToken: { type: String }, // New field for password reset token
  resetTokenExpire: { type: Date }, // New field for token expiration
  expoPushToken: { type: String, default: null }, // Add this line
});

export default mongoose.model('CompanyList', companyListSchema);