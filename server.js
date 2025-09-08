
const express = require('express');
const cors = require("cors");
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const databasePath = path.join(__dirname, 'database.db');
const app = express();
app.use(express.json());
app.use(cors());

let database = null;
const jwtSecretKey = process.env.JWT_SECRET_KEY || 'MY_SERCRET_key';

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3004, () => console.log('Server Running at http://localhost:3004/'));
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const validatePassword = (password) => {
  return password.length > 4;
};

app.post('/register', async (request, response) => {
  try {
    const { name, email, password } = request.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const selectUserQuery = `SELECT * FROM user WHERE name = ?;`;
    const databaseUser = await database.get(selectUserQuery, [name]);
    if (databaseUser === undefined) {
      if (validatePassword(password)) {
        const createUserQuery = `INSERT INTO user (name, email, password) VALUES (?, ?, ?);`;
        const dbResponse = await database.run(createUserQuery, [name, email, hashedPassword]);
        const newUserId = dbResponse.lastID;
        response.send(`Created new user with ${newUserId}`);
      } else {
        response.status(400).send('Password is too short');
      }
    } else {
      response.status(400).send('User already exists');
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    response.status(500).send('Internal Server Error');
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, jwtSecretKey, async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        request.username = payload.name;
        next();
      }
    });
  }
};

app.post('/login', async (request, response) => {
  try {
    const { name, password } = request.body;
    const selectUserQuery = `SELECT * FROM user WHERE name = ?;`;
    const databaseUser = await database.get(selectUserQuery, [name]);
    if (databaseUser === undefined) {
      response.status(400).send({"error_msg":"Invalid user"});
    } else {
      const isPasswordMatched = await bcrypt.compare(password, databaseUser.password);
      if (isPasswordMatched === true) {
        const payload = { name: name };
        const jwtToken = jwt.sign(payload, jwtSecretKey);
        response.send({ jwtToken });
      } else {
        response.status(400).send({"error_msg":"Invalid password"});
      }
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    response.status(500).send({"error_msg":"Internal Server Error"});
  }
});

app.get('/dashboard', authenticateToken, async (request, response) => {
  try {
    let { username } = request;
    console.log(username);
    const getUsersQuery = `SELECT * FROM user;`;
    const usersArray = await database.all(getUsersQuery);
    response.send({username});
  } catch (error) {
    console.log(`Error: ${error.message}`);
    response.status(500)
  }
})
