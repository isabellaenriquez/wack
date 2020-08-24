document.addEventListener('DOMContentLoaded', () => {
    // connect to websocket
    var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    var myStorage = window.localStorage; // get local storage

    // When connected, configure buttons
    socket.on('connect', () => {
        console.log('connected!');
        if (myStorage.getItem('name')) {
            // user has logged in before
            socket.emit('logged in', { 'name': myStorage.getItem('name') })
        } else {
            socket.emit('go home');
        }
    });

    socket.on('returning user', () => {
        console.log('returning user')
        if (myStorage.getItem('lastChannel') && myStorage.getItem('lastChannel') != 'index') {
            // redirect to last channel, if any or not index
            socket.emit('change channels', { 'channel': myStorage.getItem('lastChannel') });
        } else {
            socket.emit('go home');
        }
    });

    socket.on('redirect home', () => {
        console.log('redirect home');
        myStorage.setItem('lastChannel', 'index'); // add channel to client-side memory
        socket.emit('go home');
    });

    socket.on('at home', data => {
        console.log('at home');
        document.querySelector('#channel-title').innerHTML = "Home";
        // clear previous
        document.querySelector('#message-block').innerHTML = '';
        document.querySelector('#sending-block').innerHTML = '';
        document.querySelector('#sidebar-title-2').innerHTML = '';

        myStorage.setItem('lastChannel', 'index'); // client-side memory
        var landingMsg = document.createElement('h5');
        landingMsg.id = 'landing-msg';
        if (myStorage.getItem('name')) { // change landing message based on whether first login or not
            landingMsg.innerHTML = `Welcome ${myStorage.getItem('name')}.`;
            document.querySelector('#message-block').appendChild(landingMsg);
            createChannelSidebar(data['channels']);
            document.querySelector('#sidebar-sect-2').innerHTML = '';
        } else { // new user
            landingMsg.innerHTML = "Welcome to Wack! Please enter a display name to get chatting!";
            document.querySelector('#message-block').appendChild(landingMsg);
            var confirmBtn = document.createElement('button');
            var displayNameInput = document.createElement('input');
            confirmBtn.className = 'add';
            confirmBtn.innerHTML = "+";
            displayNameInput.placeholder = "Enter display name..."

            confirmBtn.onclick = function () {
                console.log('i have been clicked');
                if (displayNameInput.value.length > 0) {
                    // check if name is filled out
                    console.log('name filled out')
                    myStorage.setItem('name', displayNameInput.value); // save to local myStorage
                    socket.emit('logged in', { 'name': myStorage.getItem('name') });
                }
            };
            // add to DOM
            document.querySelector('#message-block').appendChild(displayNameInput);
            document.querySelector('#message-block').appendChild(confirmBtn);
        }
    });

    socket.on('add to channel list', data => {
        // when new channel is made, add to list for all users
        createChannelSidebar(data['channels']);
    });

    socket.on('update user list', data => {
        // when a user comes online, show all users
        createUserSidebar(data['users']);
    });

    socket.on('join channel', data => {
        // add requested channel to client-side memory
        console.log('joined channel!');
        myStorage.setItem('lastChannel', data['channel']);
        socket.emit('change channels', { 'channel': data['channel'] });
    });

    socket.on('load channel', data => {
        // load channel info and messages
        console.log('loading channel');

        // clear previous
        document.querySelector('#message-block').innerHTML = '';
        document.querySelector('#sending-block').innerHTML = '';

        // channel name and sidebar
        let channelName = data['channel'];
        document.querySelector('#channel-title').innerHTML = channelName;
        createChannelSidebar(data['channels']);
        createUserSidebar(data['users'])

        var messages = data['messages'];
        var parsed = JSON.parse(messages); // parse list of messages from String

        for (let i = 0; i < parsed.length; i++) { // add old messages
            var parsedMsg = parsed[i]
            displayMessage(parsedMsg);
        }

        // sending messages
        var messageInput = document.createElement('input');
        messageInput.placeholder = "Type something...";
        var sendBtn = document.createElement('button');
        sendBtn.className = "submit-btn";
        sendBtn.innerHTML = "Send";
        sendBtn.onclick = function () {
            if (messageInput.value.length >= 1) {
                // make sure message is not empty
                console.log('send message');
                let timestamp = new Date(Date.now()); // get current time
                timestamp = timestamp.toString();
                let message = messageInput.value;
                messageInput.value = ''; // clear previous
                socket.emit('send message', { 'message': message, 'channel': myStorage.getItem('lastChannel'), 'name': myStorage.getItem('name'), 'timestamp': timestamp });
            }
        }

        // add to doc
        document.querySelector('#sending-block').appendChild(messageInput);
        document.querySelector('#sending-block').appendChild(sendBtn);
        window.scrollTo(0,document.body.scrollHeight); // scroll automatically to bottom
    });


    socket.on('display new message', data => {
        // display newly sent message to all users in that channel
        displayMessage(data);
    });

    function displayMessage(messageData){
        // create elements
        let msg = document.createElement('div');
        msg.className = 'message';
        let msgData = document.createElement('div');
        msgData.className = 'message-data';
        let msgAuthor = document.createElement('div');
        msgAuthor.className = 'author';
        let msgText = document.createElement('div');
        msgText.className = 'message-text';
        let msgInfo = document.createElement('div')
        msgInfo.className = 'message-info';

        // add msg info to elements
        msgAuthor.innerHTML = messageData['author'];
        msgText.innerHTML = messageData['message'];
        if (messageData['timestamp']){
            msgInfo.innerHTML = messageData['timestamp'];
        }

        // add to DOM
        msg.appendChild(msgAuthor);
        msgData.appendChild(msgText);
        msgData.appendChild(msgInfo);
        msg.appendChild(msgData);
        document.querySelector('#message-block').appendChild(msg);
    }

    // creating channels
    document.querySelector('#add-channel').onclick = () => {
        console.log('creating channel');
        let newChannel = document.querySelector('#new-channel').value;
        document.querySelector('#new-channel').value = ''; // clear previous
        if (newChannel.length > 0) {
            // check if input was filled
            socket.emit('new channel', { 'new-channel': newChannel });
        };
    };

    // create channel list
    function createChannelSidebar(channels) {
        var sidebar = document.querySelector('#sidebar-sect-1');
        sidebar.innerHTML = ''; // clear
        for (i = 0; i < channels.length; i++) {
            // create and edit elements
            let li = document.createElement('li');
            let channelBtn = document.createElement('button');
            channelBtn.className = 'channel-name';
            channelBtn.innerHTML = channels[i];
            channelBtn.onclick = () => { // changing channels functionality
                console.log('changing channels');
                let channel = channelBtn.innerHTML;
                myStorage.setItem('lastChannel', channel); // add to client-side memory
                socket.emit('change channels', { 'channel': channel });
            };
            // add to DOM
            li.appendChild(channelBtn);
            sidebar.appendChild(li);
        }

    }

    // show online users
    function createUserSidebar(users){
        document.querySelector('#sidebar-title-2').innerHTML = "Users in this Channel";
        var sidebar = document.querySelector('#sidebar-sect-2');
        sidebar.innerHTML = ''; // clear
        for (i = 0; i < users.length; i++) {
            // create and edit elements
            let li = document.createElement('li');
            li.innerHTML = users[i]; 
            // add to DOM
            sidebar.appendChild(li);
        }
    }

    // changing channels
    document.querySelectorAll('.channel-name').forEach(button => {
        button.onclick = () => {
            console.log('changing channels');
            let channel = button.innerHTML;
            if (channel === "Home") { // go to home page
                socket.emit("change channels", { 'channel': 'index' });
            } else {
                myStorage.setItem('lastChannel', channel); // add to client-side
                socket.emit('change channels', { 'channel': channel });
            }
        };
    });
});