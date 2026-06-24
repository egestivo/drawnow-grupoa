const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Usuario = require('../server/models/Usuario');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
},

async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await Usuario.findOne({ googleId: profile.id });
    if (!user) {
      const displayName = profile.displayName || (profile.emails && profile.emails[0] ? profile.emails[0].value : 'Usuario');
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : undefined;
      let existingUser = email
        ? await Usuario.findOne({ $or: [{ username: displayName }, { email }] })
        : await Usuario.findOne({ username: displayName });
      if (existingUser) {
        existingUser.googleId = profile.id;
        if (email && !existingUser.email) existingUser.email = email;
        await existingUser.save();
        return done(null, existingUser);
      }
      user = new Usuario({
        googleId: profile.id,
        username: displayName,
        email: email
      });
      await user.save();
    }
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}
));
module.exports = passport;
