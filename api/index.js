const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const ws = require('ws');
const Message = require('./models/Message')
const fs = require('fs');

const app = express();
app.use('/uploads', express.static(__dirname+'/uploads'))
app.use(express.json());
app.use(cookieParser());

const mongoUrl = process.env.MONGO_URL;
// console.log(mongoUrl);
mongoose.connect(mongoUrl);
const jwtSecret = process.env.JWT_SECRET
const bcryptSalt = bcrypt.genSaltSync(10);

app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}))

async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token;
        if(token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if(err) throw err;
                resolve(userData);
            })
        } else {
            reject('no token');
        }
    }) //did not handle if else,3:34
}

app.get('/messages/:userId',async (req, res)=>{
    // res.json(req.params);
    const {userId} = req.params;
    //our userId is in token
    const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.userId;
    const messages = await Message.find({
       sender: {$in:[userId,ourUserId]},
       recipient: {$in:[userId,ourUserId]},
    }).sort({createdAt:1 });
    res.json(messages)
})

app.get('/people', async (req, res) => {
    const users = await User.find({}, {'_id':1, username:1});
    res.json(users);
})

app.get('/test', (req, res) => {
    res.json("ok");
})

app.get('/profile', (req, res) => {
    const token = req.cookies?.token;
    if(token){
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if(err) throw err;
            // const {id, username} = userData
            res.json(userData);
        })
    } else {
        res.status(401).json('no token');
    }
})

app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    const foundUser = await User.findOne({username});
    if(foundUser) {
        const passOk = bcrypt.compareSync(password, foundUser.password);
        if(passOk) {
            jwt.sign({userId: foundUser._id, username}, jwtSecret, {}, (err, token) => {
                if(err) throw err;
                res.cookie('token', token, {sameSite: 'none', secure: true}).json({
                    id: foundUser._id, //getting id from database
                });
            })
        }
    }
})

app.post('/logout', (req, res) => {
    res.cookie('token','',{sameSite:'none', secure: true}).json('ok'); 
})

//sending to database
app.post('/register', async (req, res) => {
    const {username, password} = req.body;
    const hashedPaswword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({username, password: hashedPaswword});
    jwt.sign({userId: createdUser._id, username}, jwtSecret, {}, (err, token) => {
        if(err) throw err;
        res.cookie('token', token, {sameSite: 'none', secure: true}).status(201).json({
            id: createdUser._id,
            username,
        });
    })
})

const server = app.listen(4000);

//websocket server using server obj
const wss = new ws.WebSocketServer({server});

wss.on('connection', (connection, req) => {

    function notifyAboutOnlinePeople() {
        [...wss.clients].forEach(client => {
            client.send(JSON.stringify(
                {
                    online: [...wss.clients].map(c => ({ 
                        userId: c.userId,
                        username: c.username
                    }))
                }
            ))
        });
    }

    connection.isAlive = true;
    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
            connection.isAlive = false;
            clearInterval(connection.timer)
            connection.terminate();
            notifyAboutOnlinePeople();
        }, 1000);
    }, 5000);

    connection.on('pong', () => {
        clearTimeout(connection.deathTimer);
    })

    // console.log('connected');
    const cookies = req.headers.cookie;
    if(cookies) {
        const tokenCookie = cookies.split(';').find(str => str.startsWith('token='))
        if(tokenCookie) {
            const token = tokenCookie.split('=')[1];
            if(token) {
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if(err) throw err;
                    // console.log(userData);
                    const {userId, username} = userData;
                    connection.userId = userId;
                    connection.username = username;
                })
            }
        }
    }

    connection.on('message', async (message) => { 
        // console.log(isBinary ? message.toString());
        const messageData = JSON.parse(message.toString());
        console.log(messageData);
        let filename="";
        const {recipient, text, file} = messageData;
        console.log(recipient, text);
        if(file) {
            const parts = file.name.split('.');
            const ext = parts[parts.length-1];
            filename = Date.now()+"."+ext;
            const path = __dirname+'/uploads/'+filename
            const bufferData = new Buffer(file.data.split(',')[1], 'base64');
            fs.writeFile(path, bufferData, ()=>{
                console.log("saved",path);
            })
        }
        if(recipient && (text || file)) {
            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient: recipient,
                text: text,
                file: file ? filename : null
            });
            [...wss.clients]
                .filter(c => c.userId === recipient)
                .forEach(c => c.send(JSON.stringify({text, sender: connection.userId, recipient, file: file ? filename : null, _id: messageDoc._id})));
        }
    });

    // console.log([...wss.clients].map(c => c.username)); //converting objets to array
    notifyAboutOnlinePeople();
    
})
