const express = require('express');
const passport = require('../config/passport');
const router = express.Router();
const oauthController = require('../controllers/oauth.controller');

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login',
  }), 
  oauthController.googleCallback 
);
module.exports = router;