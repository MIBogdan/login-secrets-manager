const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const bcryptjs = require("bcryptjs");
const passport = require("passport");
const Strategy = require("passport-local");
const session = require("express-session");
const util = require("util");
const env = require("dotenv");
const GoogleStrategy = require("passport-google-oauth2");

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: "secure_key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

const db = mysql.createConnection({
  user: "root",
  host: "localhost",
  database: "secrets",
  password: "bB571174000",
  port: 3306,
});
db.connect();

const query = util.promisify(db.query).bind(db);

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/secrets", async (req, res) => {
  const userEmail = req.user.email;
  if (req.isAuthenticated()) {
    try {
      const result = await query(`SELECT secret FROM users WHERE email = '${userEmail}'`);
      const secret = result[0].secret;
      if (secret) {
        res.render("secrets.ejs", { secret: secret });
      } else {
        res.render("secrets.ejs", { secret: "You don't have any secrets. Submit one!" });
      }
    } catch (err) {
      res.send(err);
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit.ejs");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", async (req, res) => {
  const userSecret = req.body.secret;
  const email = req.user.email;
  try {
    await query(`UPDATE users SET secret = '${userSecret}' WHERE email = '${email}'`);
    res.redirect("/secrets");
  } catch (err) {
    res.send(err);
  }
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) console.log(err);
    res.redirect("/");
  });
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await query(`SELECT * FROM users WHERE email = '${email}'`);

    if (checkResult.length > 0) {
      res.redirect("/login");
    } else {
      bcryptjs.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await query(`INSERT INTO users (email, password, secret) VALUES ('${email}', '${hash}', "")`);
          const user = result[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/login");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await query(`SELECT * FROM users WHERE email = '${username}'`);
      if (result.length > 0) {
        const user = result[0];
        const storedHashedPassword = user.password;
        bcryptjs.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            //Error with password check
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              //Passed password check
              return cb(null, user);
            } else {
              //Did not pass password check
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
