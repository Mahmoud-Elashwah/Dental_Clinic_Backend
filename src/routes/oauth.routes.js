const express = require('express');
const passport = require('../config/passport');
const router = express.Router();
const oauthController = require('../controllers/oauth.controller');

router.get(
  '/google',
  (req, res, next) => {
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: req.query.role || 'patient',
      prompt: 'select_account'
    })(req, res, next);
  }
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