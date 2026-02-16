
const express = require('express');
const cors = require("cors");
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { request } = require('http');

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
    const selectUserQuery = `SELECT * FROM users WHERE name = ?;`;
    const databaseUser = await database.get(selectUserQuery, [name]);
    if (databaseUser === undefined) {
      if (validatePassword(password)) {
        const createUserQuery = `INSERT INTO users (name, email, password) VALUES (?, ?, ?);`;
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
    const selectUserQuery = `SELECT * FROM users WHERE name = ?;`;
    const databaseUser = await database.get(selectUserQuery, [name]);
    if (databaseUser === undefined) {
      response.status(400).send({"error_msg":"Invalid user"});
    } else {
      const isPasswordMatched = await bcrypt.compare(password, databaseUser.password);
      if (isPasswordMatched === true) {
        const payload = { name: name };
        const jwtToken = jwt.sign(payload, jwtSecretKey);
        response.send({ jwtToken});
        
      } else {
        response.status(400).send({"error_msg":"Invalid password"});
      }
    }
  } catch (error) {
    console.log(`Error:`);
    response.status(500).send({"error_msg":"Internal Server Error"});
  }
});

app.get('/dashboard', authenticateToken, async (request, response) => {
  try {
    const getUsersQuery = `SELECT * FROM users`;
      response.send(`success`)
   } catch (error) {
    console.log(`Error:`);
    response.status(500)
  }
})


app.post('/transactions',authenticateToken, async (request, response) => {
  
  const { title,amount, category,date,type} = request.body

  try {
    const result = await database.run('INSERT INTO transactions (title, amount, category, date,type) VALUES ( ?,?,?,?,?)', [title, amount, category, date,type]);
    console.log(result)
    response.json({ id:result.lastID, title, amount, category, date,type });
  
      console.log(result)
       response.send(result)
     }catch (error){
      console.log(`Error : ${error}`)
      response.status(500).send('Database error')
     }
  
  
})

app.get('/transactions',authenticateToken, async (request, response) => {
  try {
    const getUsersQuery = `SELECT * FROM transactions`;
      const usersGetArray = await database.all(getUsersQuery);
  response.send(usersGetArray) 

   } catch (error) {
    console.log(`Error:`);
    response.status(500)
  }
})


app.delete('/transactions/:id/',authenticateToken,async (request,response) => {
  try{
    const {id} = request.params 
  const deleteQuery = `
    DELETE FROM
      transactions
    WHERE
      id = ? RETURNING *`;
  const userData = await database.get(deleteQuery,[id]);
  response.status(200).json({userData});

  }catch (error){
    return response.status(500).json({success:false,message:"can't delete amout details"})
  }
})