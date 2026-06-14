require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/Users');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const email = 'test_select_' + Date.now() + '@example.com';
  
  // Create user
  await User.create({
    name: 'Test',
    email,
    password: 'oldPassword123'
  });
  
  // Fetch WITHOUT password
  const user = await User.findOne({ email });
  console.log("Fetched password:", user.password); // undefined
  
  // Update password
  user.password = 'newPassword123';
  await user.save();
  
  // Fetch WITH password
  const checkUser = await User.findOne({ email }).select('+password');
  console.log("Updated password in DB:", checkUser.password);
  
  const isOld = await checkUser.comparePassword('oldPassword123', checkUser.password);
  const isNew = await checkUser.comparePassword('newPassword123', checkUser.password);
  
  console.log("Is old match?", isOld);
  console.log("Is new match?", isNew);
  
  await User.deleteOne({ email });
  mongoose.disconnect();
}
test();
