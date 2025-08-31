// // passport.js
// import passport from 'passport';
// import { Strategy as LocalStrategy } from 'passport-local';
// import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import bcrypt from 'bcrypt';

// const mockAccounts = {};
// export { mockAccounts };

// // Local login
// passport.use(new LocalStrategy({
//   usernameField: 'email',
//   passwordField: 'password'
// }, (email, password, done) => {
//   const user = mockAccounts[email];
//   if (!user) {
//     return done(null, false, { message: 'No user found' });
//   }

//   // Compare hashed password
//   bcrypt.compare(password, user.password, (err, isMatch) => {
//     if (err) return done(err);
//     if (!isMatch) return done(null, false, { message: 'Incorrect password' });
//     return done(null, user);
//   });
// }));

// // Google login
// passport.use(new GoogleStrategy({
//   clientID: process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   callbackURL: '/auth/google/callback'
// }, (accessToken, refreshToken, profile, done) => {
//   const email = profile.emails?.[0]?.value;
//   if (!email) return done(null, false);

//   let user = mockAccounts[email];
//   if (!user) {
//     user = {
//       id: profile.id,
//       email,
//       anonName: `anon${String(Object.keys(mockAccounts).length + 1).padStart(5, '0')}`
//     };
//     mockAccounts[email] = user;
//   }

//   return done(null, user);
// }));

// passport.serializeUser((user, done) => {
//   done(null, user.email || user.wallet);
// });

// passport.deserializeUser((id, done) => {
//   done(null, mockAccounts[id] || null);
// });

// passport.js
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcrypt';
import { User } from '../models/Users.js';

// Local login
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return done(null, false, { message: 'No user found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return done(null, false, { message: 'Incorrect password' });

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// Google login
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails?.[0]?.value;
  if (!email) return done(null, false);

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      googleId: profile.id,
      email,
      anonName: `anon${Date.now()}`
    });
  }
  return done(null, user);
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
