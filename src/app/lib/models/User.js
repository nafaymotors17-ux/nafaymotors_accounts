import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["super_admin", "user"],
    default: "user",
  },
  address: {
    type: String,
    trim: true,
  },
});

// Simple password comparison
UserSchema.methods.comparePassword = function (candidatePassword) {
  return this.password === candidatePassword;
};

export default mongoose.models.User || mongoose.model("User", UserSchema);
