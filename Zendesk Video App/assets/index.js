const SERVER_BASE_URL = 'SERVER_BASE_URL';
let apiKey;
let sessionId;
let publisher;
let session;
let token;
let publishing = false;
let archiveId;
let screenSharing = false;
let archiving = false;
let video = false;

$(function() {
  let client = ZAFClient.init();
  client.invoke('resize', { width: '100%', height: '79vh'  });
  //videos.style.display = 'none';
 

  client.get(['ticket.id', 'ticket.requester.id']).then(data => {
    let user_id = data['ticket.requester.id']
    let  ticket_id = data['ticket.id'];

    fetch(SERVER_BASE_URL + '/room/' + user_id + "-" + ticket_id).then(function(res) {
    return res.json()
    }).then(res => {
      apiKey = res.apiKey;
      sessionId = res.sessionId;
      token = res.token;
    }).catch(handleError);
  });

});


let handleRecording =() => {
  archiving ? stopArchive() : startArchive();
  //setRecording( true );
}

let handleError = (error) => {
  if (error) {
    alert(error.message);
  }

}

let startArchive = () => {
  
  fetch(SERVER_BASE_URL +'/archive/start', {
    method: 'post',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({
      'sessionId': sessionId
    })
  })
  .then((response) => {
    return response.json();
  })
  .then((data) => {
    console.log('data from server when starting archiving', data)
  })
  .catch(error => console.log('errror starting archive', error))
}


let stopArchive = () => {
  console.log('archiveID' + archiveID);
  fetch(SERVER_BASE_URL + '/archive/' + archiveID + '/stop', {
    method: 'post',
    headers: {
      'Content-type': 'application/json'
    }
  })
  .then((response) => {
    return response.json()
  })
  .then((data) => {
    console.log('data from server when stopping archiving', data)
  })
  .catch(error => console.log('errror stopping archive', error))
}

let startPublishingVideo = () => {
  video ? publisher.publishVideo(false) : publisher.publishVideo(true)
}


let startPublishingScreen = () => {
  if (screenSharing === true){
         session.unpublish(screenPublisher)
       }
       else{
  OT.checkScreenSharingCapability(response => {
    if(!response.supported || response.extensionRegistered === false) {
      // This browser does not support screen sharing.
    } 
     else {
      // Screen sharing is available. Publish the screen.
      screenPublisher = OT.initPublisher('publisher',
        {videoSource: 'screen', insertMode: "after"},
        error => {
          if (error) {
            console.log(error)
          } else {
            session.publish(screenPublisher, error => {
              if (error) {
                console.log(error)
              }
            })
            .on("streamCreated", event => {  
              console.log("Publisher started streaming. " + event.stream.videoType)
                if (event.stream.videoType === 'screen'){
                  screenSharing = true;
                  document.getElementById("startPublishingScreenId").innerHTML = 'stop screenShare'
                }
              })
              .on("streamDestroyed", event => {
               if (event.stream.videoType === 'screen'){screenSharing = false
              document.getElementById("startPublishingScreenId").innerHTML = 'start screenShare'}
              console.log("Publisher stopped streaming.");
            });
          }
        }
      );
    }
  })
};
}


let initializeSession = () => {
  
  videos.style.display = 'block';
  session = OT.initSession(apiKey, sessionId);

  // Create a publisher
  publisher = OT.initPublisher('publisher', {
    insertMode: 'replace',
    publishVideo: false,
  }, handleError);

  // Connect to the session
  session.connect(token, error => {
    // If the connection is successful, initialize a publisher and publish to the session
    if (error) {
      handleError(error);
    } else {
    session.publish(publisher)
    document.getElementById("initiatesession").style.display = "none"
     
    }
  });

   session.on('archiveStarted', event => {
            archiveID = event.id;
            archiving = true
            document.getElementById('handleRecording').innerHTML = 'Stop Archive';
            console.log('ARCHIVE STARTED' + archiveID);
  });  

   session.on('archiveStopped',  event => {
            archiveID = event.id;
            archiving = false
            document.getElementById('handleRecording').innerHTML = 'Start Archive';
            console.log('ARCHIVE STOPED' + archiveID);
  });  

  session.on("streamPropertyChanged", event => {
              console.log(event.newValue)
             video = event.newValue
             video ? document.getElementById("startPublishingVideoId").innerHTML = 'Turn Video off' : document.getElementById("startPublishingVideoId").innerHTML = 'Turn Video on';
            });

  session.on('streamCreated', event => {
    console.log('stream created' + event.stream)
    session.subscribe(event.stream, 'subscriber', {
      insertMode: 'append',

    }, handleError);
  });
}
