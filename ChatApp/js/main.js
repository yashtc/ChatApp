$(function () {
    "use strict";

    // for better performance - to avoid searching in DOM
    var content = $('#content');
    var input = $('#input');
    var status = $('#status');
    var roomSelector = $('#roomSelector');
    var commandMessages = $('#commandMessages');
    var roomContentContainer = $('#roomContentContainer');

    // my color assigned by the server
    var myColor = false;
    // my name sent to the server
    var myName = false;

    // if user is running mozilla then use it's built-in WebSocket
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    // if browser doesn't support WebSocket, just show some notification and exit
    if (!window.WebSocket) {
        content.html($('<p>', { text: 'Sorry, but your browser doesn\'t '
                                    + 'support WebSockets.'} ));
        input.hide();
        $('span').hide();
        return;
    }

    // open connection
    var connection = new WebSocket('ws://localhost:1337');

    connection.onopen = function () {
        // first we want users to enter their names
        input.removeAttr('disabled');
        status.text('Choose name:');
    };

    connection.onerror = function (error) {
        // just in there were some problems with conenction...
        content.html($('<p>', { text: 'Sorry, but there\'s some problem with your '
                                    + 'connection or the server is down.' } ));
    };

    // most important part - incoming messages
    connection.onmessage = function (message) {
        // try to parse JSON message. Because we know that the server always returns
        // JSON this should work without any problem but we should make sure that
        // the massage is not chunked or otherwise damaged.
        try {
            var json = JSON.parse(message.data);
        } catch (e) {
            console.log('This doesn\'t look like a valid JSON: ', message.data);
            return;
        }

        // NOTE: if you're not sure about the JSON structure
        // check the server source code above
        if (json.type === 'username_error') { // user name error message from the server
        	content.html($('<p>', { text: 'Error: User name ' + json.data + ' is already taken. Please try another one' } ));
        	input.removeAttr('disabled').val('');
        	myName = false;
        } else if (json.type === 'roomnamenotunique_error') { // room name error message from the server
        	commandMessages.html($('<p>', { text: 'Error: Room name ' + json.data + ' is already taken. Please try another one' } ));
        	input.removeAttr('disabled').val('');
        	myName = false;
        } else if (json.type === 'roomnamenotfound_error') { // room name error message from the server
        	commandMessages.html($('<p>', { text: 'Error: Room name ' + json.data + ' does\'nt exist. Please try again' } ));
        	input.removeAttr('disabled').val('');
        	myName = false;
        } else if (json.type === 'color') { // first response from the server with user's color
            myColor = json.data;
            content.html('');
            status.text(myName + ': ').css('color', myColor);
            input.removeAttr('disabled').focus();
            // from now user can start sending messages
        } else if (json.type === 'room_created') {
        	var roomName = json.roomName;
        	roomContentContainer.append('<div id="' + roomName.toLowerCase() + 'Content"><div>');
        	$('#selectRoomHeader').show();
        	roomSelector.append('<label for="' + roomName + '"><input type="radio" name="roomSelectionOption" onchange="roomChanged(this)" id="' + roomName + '" /> ' + roomName + '</label>');
        	$('#' + roomName).prop('checked', true);
        	$('#roomContentContainer div').hide();
        	$('#' + roomName.toLowerCase() + 'Content').show();
        	input.removeAttr('disabled').focus();
        } else if (json.type === 'room_joined') {
        	var roomName = json.roomName;
        	roomContentContainer.append('<div id="' + roomName.toLowerCase() + 'Content"><div>');
        	$('#selectRoomHeader').show();
        	roomSelector.append('<label for="' + roomName + '"><input type="radio" name="roomSelectionOption" onchange="roomChanged(this)" id="' + roomName + '" /> ' + roomName + '</label>');
        	$('#' + roomName).prop('checked', true);
        	var roomNameContentDiv = $('#' + roomName.toLowerCase() + 'Content');
        	$('#roomContentContainer div').hide();
        	$('#' + roomName.toLowerCase() + 'Content').show();
            // insert every single message to the chat window
        	console.log('Received ' + json.data.length);
            for (var i=0; i < json.data.length; i++) {
            	addMessage(roomNameContentDiv, json.data[i].author, json.data[i].text,
                           json.data[i].color, new Date(json.data[i].time));
            }
        	input.removeAttr('disabled').focus();
        } else if (json.type === 'room_left') {
        	var roomName = json.roomName;
        	$('#' + roomName.toLowerCase() + 'Content').remove();
        	$('#' + roomName).parent().remove();
        	$('input[name=roomSelectionOption]:first').prop('checked', true);
        	var roomToBeDisplayed = $('input[name=roomSelectionOption]:first').attr('id');
        	if (roomToBeDisplayed) {
	        	$('#roomContentContainer div').hide();
	        	$('#' + roomToBeDisplayed.toLowerCase() + 'Content').show();
        	} else {
        		$('#content').show();
        		$('#selectRoomHeader').hide();
        	}
        	input.removeAttr('disabled').focus();
        } else if (json.type === 'history') { // entire message history
        	var roomName = json.roomName;
        	roomContentContainer.append('<div id="' + roomName.toLowerCase() + 'Content"><div>');
        	var roomNameContentDiv = $('#' + roomName.toLowerCase() + 'Content');
            // insert every single message to the chat window
            for (var i=0; i < json.data.length; i++) {
            	addMessage(roomNameContentDiv, json.data[i].author, json.data[i].text,
                           json.data[i].color, new Date(json.data[i].time));
            }
        } else if (json.type === 'message') { // it's a single message
            input.removeAttr('disabled'); // let the user write another message
            var roomName = json.roomName;
        	//roomContentContainer.append('<div id="' + roomName.toLowerCase() + 'Content"><div>');
        	var roomNameContentDiv = $('#' + roomName.toLowerCase() + 'Content');
            addMessage(roomNameContentDiv, json.data.author, json.data.text,
                       json.data.color, new Date(json.data.time));
        } else {
        	input.removeAttr('disabled');
            console.log('Hmm..., I\'ve never seen JSON like this: ', json);
        }
    };

    /**
     * Send mesage when user presses Enter key
     */
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val().trim();
            if (!msg) {
                return;
            }
            commandMessages.html('');
            if (myName && !(msg.startsWith('mkgroup ') || msg.startsWith('lvgroup ') || msg.startsWith('jgroup '))) {
	            var roomName = $('input[name=roomSelectionOption]:checked').attr('id');
	            if (roomName) {
	            	msg = roomName + ' ' + msg;
	            } else {
	            	return;
	            }
            }
            // we know that the first message sent from a user their name
            if (myName === false) {
            	myName = msg;
            }
            // send the message as an ordinary text
            connection.send(msg);
            $(this).val('');
            // disable the input field to make the user wait until server
            // sends back response
            input.attr('disabled', 'disabled');

        }
    });

    /**
     * This method is optional. If the server wasn't able to respond to the
     * in 3 seconds then show some error message to notify the user that
     * something is wrong.
     */
    setInterval(function() {
        if (connection.readyState !== 1) {
            status.text('Error');
            input.attr('disabled', 'disabled').val('Unable to comminucate '
                                                 + 'with the WebSocket server.');
        }
    }, 3000);

    /**
     * Add message to the chat window
     */
    function addMessage(contentDiv, author, message, color, dt) {
        contentDiv.append('<p><span style="color:' + color + '">' + author + '</span> @ ' +
             + (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
             + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes())
             + ': ' + message + '</p>');
    }
});

function roomChanged(elm) {
	$('#commandMessages').html('');
	var roomNameToBeDisplayed = $(elm).attr('id');
	$('#roomContentContainer div').hide();
	console.log(roomNameToBeDisplayed);
	$('#' + roomNameToBeDisplayed.toLowerCase() + 'Content').show();
}