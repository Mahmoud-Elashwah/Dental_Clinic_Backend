const User = require('../models/Users');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const saltRounds = 10;

// generate random password
function generateRandomPassword() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  const length = Math.floor(Math.random() * (20 - 4 + 1)) + 4;

  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  return password;
}

exports.googleCallback = async (req, res) => {
  try {
    const userObj = req.user;

    const userData = {
      email: userObj.profile.emails[0].value,
      name: userObj.profile.displayName,
      photo: userObj.profile.photos[0].value,
    };

    // 🔍 check user
    let user = await User.findOne({ email: userData.email });

    // 🟢 SIGN UP
    if (!user) {
      const password = await bcrypt.hash(
        generateRandomPassword(),
        saltRounds
      );

      user = await User.create({
        email: userData.email,
        name: userData.name,
        avatar: userData.photo,
        password,
      });
    }

    // 🔐 TOKENS
    const payload = {
      id: user._id,
    };

    const access_token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    const refresh_token = jwt.sign(
      { ...payload },
      process.env.JWT_SECRET_REFRESH,
      { expiresIn: '7d' }
    );

    
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: false, 
      maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
    });

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const intendedRole = req.query.state || 'patient';
    // Redirect to frontend with token
    return res.redirect(`http://localhost:5173/oauth-success?token=${access_token}&intendedRole=${intendedRole}`);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};