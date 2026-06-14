require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/Users');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const email = 'test_pwd_' + Date.now() + '@example.com';
  const user = await User.create({
    name: 'Test Pwd',
    email: email,
    password: 'oldPassword123'
  });
  
  console.log("Created User Password:", user.password); // Should be hashed
  
  const fetchedUser = await User.findOne({ email }); // without +password
  
  fetchedUser.password = "newPassword123";
  await fetchedUser.save();
  
  const checkUser = await User.findOne({ email }).select("+password");
  console.log("Updated User Password:", checkUser.password);
  
  const isMatchNew = await checkUser.comparePassword("newPassword123", checkUser.password);
  const isMatchOld = await checkUser.comparePassword("oldPassword123", checkUser.password);
  
  console.log("Matches New?", isMatchNew);
  console.log("Matches Old?", isMatchOld);
  
  await User.deleteOne({ email });
  mongoose.disconnect();
}
test();
