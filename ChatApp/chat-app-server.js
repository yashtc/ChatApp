"use strict";

//Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-chat';

//Port where we'll run the websocket server
var webSocketsServerPort = 1337;

//websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');

/**
* Global variables
*/
//latest 100 messages
var history = [ ];
//list of currently connected clients (users)
var clients = [ ];
//list of rooms (aka group chats)
var rooms = [ ];
var roomNames = [ ];
//list of user names
var userNames = [ ];

/**
* Helper function for escaping input strings
*/
function htmlEntities(str) {
 return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

//Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
//... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

/**
* HTTP server
*/
var server = http.createServer(function(request, response) {
 // Not important for us. We're writing WebSocket server, not HTTP server
});
server.listen(webSocketsServerPort, function() {
 console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});

/**
* WebSocket server
*/
var wsServer = new webSocketServer({
 // WebSocket server is tied to a HTTP server. WebSocket request is just
 // an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6
 httpServer: server
});

//This callback function is called every time someone
//tries to connect to the WebSocket server
wsServer.on('request', function(request) {
 console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

 // accept connection - you should check 'request.origin' to make sure that
 // client is connecting from your website
 // (http://en.wikipedia.org/wiki/Same_origin_policy)
 var connection = request.accept(null, request.origin); 
 // we need to know client index to remove them on 'close' event
 var index = clients.push(connection) - 1;
 var userName = false;
 var userColor = false;

 console.log((new Date()) + ' Connection accepted.');

 // send back chat history
 if (history.length > 0) {
     //connection.sendUTF(JSON.stringify( { type: 'history', data: history} ));
 }

 // user sent some message
 connection.on('message', function(message) {
     if (message.type === 'utf8') { // accept only text
    	 var actualMessageString = message.utf8Data;
         if (userName === false) { // first message sent by user is their name
             // remember user name
			var testUserName = htmlEntities(message.utf8Data);
			if (userNames.indexOf(testUserName.toLowerCase()) === -1) {
				// it's a valid user name
				userName = testUserName;
				userNames.push(userName.toLowerCase());
				// get random color and send it back to the user
				userColor = colors.shift();
				connection.sendUTF(JSON.stringify({
					type : 'color',
					data : userColor
				}));
				console.log((new Date()) + ' User is known as: ' + userName
                     + ' with ' + userColor + ' color.');
			} else {
				// It's an invalid user name, ask user to select another one
				connection.sendUTF(JSON.stringify({
					type : 'username_error',
					data : testUserName
				}));
				console.log((new Date()) + ' Username ' + testUserName + ' rejected');
			}
         } else if (actualMessageString.startsWith('mkgroup ')) {
        	 var requestedRoomName = actualMessageString.split('mkgroup ')[1];
        	 if (requestedRoomName && roomNames.indexOf(requestedRoomName.toLowerCase()) == -1) {
        		 // it's a valid room name
        		 roomNames.push(requestedRoomName.toLowerCase());
        		 var roomObj = {
        				 name: requestedRoomName,
        				 history: [],
        				 members: [connection]
        		 };
        		 rooms.push(roomObj);
        		 connection.sendUTF(JSON.stringify({
 					type : 'room_created',
 					roomName : requestedRoomName,
 					data : []
 				}));
 				console.log((new Date()) + ' User ' + userName
                      + ' created new room ' + requestedRoomName);
        	 } else {
        		 // else it's an invalid room
        		 connection.sendUTF(JSON.stringify({
 					type : 'roomnamenotunique_error',
 					data : requestedRoomName
 				}));
        		 console.log((new Date()) + ' New room ' + requestedRoomName 
        				 + ' by ' + userName + ' rejected');
        	 }
         } else if (actualMessageString.startsWith('lvgroup ')) {
        	 var requestedRoomName = actualMessageString.split('lvgroup ')[1];
        	 if (requestedRoomName && roomNames.indexOf(requestedRoomName.toLowerCase()) != -1) {
        		 // it's a valid room name
        		 var roomIndex = -1;
        		 for (i = 0; i < rooms.length; i++) {
        			 if (rooms[i].name === requestedRoomName) {
        				 rooms[i].members.splice(rooms[i].members.indexOf(connection), 1);
        				 roomIndex = i;
        				 break;
        			 }
        		 }
        		 if (rooms[roomIndex].members.length < 1) {
        			 roomNames.splice(roomNames.indexOf(requestedRoomName.toLowerCase()), 1);
        		 }
        		 connection.sendUTF(JSON.stringify({
 					type : 'room_left',
 					roomName : requestedRoomName,
 					data : []
 				}));
 				console.log((new Date()) + ' User ' + userName
                      + ' left room ' + requestedRoomName);
        	 } else {
        		 // else it's an invalid room
        		 connection.sendUTF(JSON.stringify({
 					type : 'roomnamenotfound_error',
 					data : requestedRoomName
 				}));
        		 console.log((new Date()) + ' New room ' + requestedRoomName 
        				 + ' by ' + userName + ' rejected');
        	 }
         } else if (actualMessageString.startsWith('jgroup ')) {
        	 var requestedRoomName = actualMessageString.split('jgroup ')[1];
        	 if (requestedRoomName && roomNames.indexOf(requestedRoomName.toLowerCase()) != -1) {
        		 // it's a valid room name
        		 var roomIndex = -1;
        		 for (i = 0; i < rooms.length; i++) {
        			 if (rooms[i].name === requestedRoomName) {
        				 if (rooms[i].members.indexOf(connection) === -1) {
        					 rooms[i].members.push(connection);
        				 }
        				 roomIndex = i;
        				 break;
        			 }
        		 }
        		 connection.sendUTF(JSON.stringify({
 					type : 'room_joined',
 					roomName : requestedRoomName,
 					data : rooms[roomIndex].history
 				}));
 				console.log((new Date()) + ' User ' + userName
                      + ' joined room ' + requestedRoomName);
        	 } else {
        		// else it's an invalid room
        		 connection.sendUTF(JSON.stringify({
 					type : 'roomnamenotfound_error',
 					data : requestedRoomName
 				}));
        		 console.log((new Date()) + ' Room join request for ' + requestedRoomName 
        				 + ' by ' + testUserName + ' rejected');
        	 }
         } else { // log and broadcast the message
        	 var roomForBroadcast = actualMessageString.split(/ (.+)?/)[0],
        	 actualMessage = actualMessageString.split(/ (.+)?/)[1];
        	 
             console.log((new Date()) + ' Received Message for ' + roomForBroadcast + ' from '
                         + userName + ': ' + actualMessage);
             
             // we want to keep history of all sent messages
             var obj = {
                 time: (new Date()).getTime(),
                 text: htmlEntities(actualMessage),
                 author: userName,
                 color: userColor
             };
             var roomIndex = -1;
    		 for (i = 0; i < rooms.length; i++) {
    			 if (rooms[i].name === roomForBroadcast) {
    				 rooms[i].history.push(obj);
    				 //rooms[i].history.push(obj);
    				 roomIndex = i;
    				 break;
    			 }
    		 }

             // broadcast message to all connected clients
             var json = JSON.stringify({ type:'message', roomName: roomForBroadcast, data: obj });
             for (var i=0; i < rooms[roomIndex].members.length; i++) {
            	 rooms[roomIndex].members[i].sendUTF(json);
             }
         }
     }
 });

 // user disconnected
 connection.on('close', function(connection) {
     if (userName !== false && userColor !== false) {
         console.log((new Date()) + " Peer "
             + connection.remoteAddress + " disconnected.");
         // remove user from the list of connected clients
         clients.splice(index, 1);
         // push back user's color to be reused by another user
         colors.push(userColor);
     }
 });

});
