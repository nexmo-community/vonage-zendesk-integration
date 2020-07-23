/* eslint-disable no-console, no-path-concat */
const fs = require('fs');
const bodyParser = require('body-parser')
const express = require('express');
const router = express.Router();
const path = require('path');
const app = express();
const _ = require('lodash');
const Nexmo = require('nexmo')
const request = require ('request')
const Zendesk = require('zendesk-node-api');
const ZD = require('node-zendesk');
const ejs = require('ejs')
const cors = require('cors');
const dotenv = require('dotenv')
dotenv.config();
let apiKey = process.env.apiKey
let  apiSecret = process.env.apiSecret
const AWS = require('aws-sdk');

const client = ZD.createClient({
  username:  process.env.username,
  token:     process.env.token,
  remoteUri: process.env.remoteUri
});

const OpenTok = require('opentok');
const opentok = new OpenTok(apiKey, apiSecret);

// Initialize the express app
app.use(cors());
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({
  extended: true
}));

let ticketId

// Starts the express app
const init = () => {
  app.listen(8080, function () {
    console.log('You\'re app is now ready at http://localhost:8080/');
  });
}

init();

 let roomToSessionIdDictionary = {};

// returns the room name, given a session ID that was associated with it
const findRoomFromSessionId = sessionId => {
  return _.findKey(roomToSessionIdDictionary,  value => { return value === sessionId; });
}

app.get ('/room/:name', (req , res)=> {
  if(!req.params.name){res.status(402).end()}
  let roomName = req.params.name;
  let sessionId;
  let token;
  console.log('attempting to create a session associated with the room: ' + roomName);

  let requesterId = roomName.split("-")[0]
   ticketId = roomName.split("-")[1]

  checkIfValid(ticketId, req).then(response =>{

    if (response && response.toString() === requesterId){

      if (req.headers.host === remoteUri && req.headers.referer.split("/")[3] === "hc"){ updateTicket(ticketId)}
      
      if (roomToSessionIdDictionary[roomName]) {
        sessionId = roomToSessionIdDictionary[roomName];
        console.log('Someone requested to join ' + sessionId)
        token = opentok.generateToken(sessionId);
        res.setHeader('Content-Type', 'application/json');
        console.log(token)
        res.send({
          apiKey: apiKey,
          sessionId: sessionId,
          token: token
        });

      }
      else {
        giveMeSession().then(session => {
          roomToSessionIdDictionary[roomName] = session.sessionId;
          console.log(session.sessionId);
          token = opentok.generateToken(session.sessionId);
          console.log(token)
          res.setHeader('Content-Type', 'application/json');
          res.send({
                  apiKey: apiKey,
                  sessionId: session.sessionId,
                  token: token
          });

        })
        .catch(e => res.status(500).send({ error: 'createSession error:' + e }))
      }
    }

    else{res.status(404).end()}

})
.catch((e) => {
  res.status(404).end()
})

})

app.post('/archive/start',  (req, res) => {
  var json = req.body;
  var sessionId = json.sessionId;
  opentok.startArchive(sessionId, { name: 'testsessionrecording12345$£3323^&drdfhfjkshfjdkgfdsfghdj?¢¢¢#€' },  (err, archive) => {
    if (err) {
      console.error('error in startArchive');
      console.error(err);
      res.status(500).send({ error: 'startArchive error:' + err });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});

app.post('/archive/:archiveId/stop',  (req, res) => {
  var archiveId = req.params.archiveId;
  console.log('attempting to stop archive: ' + archiveId);
  opentok.stopArchive(archiveId, function (err, archive) {
    if (err) {
      console.error('error in stopArchive');
      console.error(err);
      res.status(500).send({ error: 'stopArchive error:' + err });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});

app.post('/events',  (req, res) => {
  res.send('OK')
  if(req.body.status === 'uploaded'){
  console.log(req.body)
  let archiveName = apiKey + "/" + req.body.id + "/archive.mp4"
  downloadVideo(req.body.id + ".mp4", archiveName)
}
})

const checkIfValid = (ticketId, res) => {
  return new Promise(
    (resolve, reject) => {
      client.tickets.show(ticketId, function(err, request, result){
        if (err) reject(err);
        resolve(result.requester_id);

      })
   }
 );
};

  
const updateTicket = (ticketId) => {
let notification  = 'The ticket requester would like to talk to you.'
 client.tickets.update(ticketId, {"ticket":{comment:{"body": notification, "public": false}}}, (err, req, res) => {

  if(!err){console.log('Ticket updated')                 
    
  }}
)}

const downloadVideo = (archiveName, Key) => {

  var fileStream = fs.createWriteStream(archiveName);
  s3 = new AWS.S3({apiVersion: '2020-06-11'});
  var s3Stream = s3.getObject({Bucket: 'zendeskopentok', Key: Key}).createReadStream();
  s3Stream.on('error', function(err) {
  console.error(err);
  });

  s3Stream.pipe(fileStream).on('error', function(err) {
      // capture any errors that occur when writing data to the file
      console.error('File Stream:', err);
  }).on('close', function() {
      console.log('Done.');
      getToken(archiveName)
  });

}

const getToken = (archiveName) => {
  client.attachments.upload(__dirname + '/' + archiveName , {binary: false, filename: archiveName}, (err, req, result) => {
    if (err) {
      console.log("error:", err);
    }
    console.log("token:", result.upload.token);
    uploadVideo(result.upload.token, ticketId)
  })
}

const uploadVideo = (token, ticketId) =>{

  let ticket = {
  "ticket":{"comment": { "body": "This is the recording of the call", "public": true, "uploads":[token]},
  }};

  client.tickets.update(ticketId,ticket, (err, req, res) => {
    if(!err){
      console.log(req)
    }
  })

}

const giveMeSession = ()=>{
  return new Promise((resolve, reject) => {
        opentok.createSession({ mediaMode: 'routed' }, (err, session) => {
          if (err) {
            console.log('[Opentok - createRoutedSession] - Err', err);
            reject(err);
          }
          resolve(session);
        });
  })
 }


