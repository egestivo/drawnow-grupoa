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
            // 1. Buscar si el usuario ya existe por su Google ID
            let user = await Usuario.findOne({ googleId: profile.id });
            if (!user) {
                // 2. Si no existe, verificar si existe un usuario con el mismo username/email
                const emailOrName = profile.emails && profile.emails[0] ? profile.emails[0].value :
                    profile.displayName;
                let existingUser = await Usuario.findOne({ username: emailOrName });
                if (existingUser) {
                    // Si ya existe el nombre pero no tiene Google ID vinculado, se lo vinculamos
                    existingUser.googleId = profile.id;
                    await existingUser.save();
                    return done(null, existingUser);
                }
                // 3. Crear nuevo usuario si no existe de ninguna forma
                user = new Usuario({
                    googleId: profile.id,
                    username: emailOrName
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