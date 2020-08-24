import os

from flask import Flask, session, render_template, request, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
from functools import wraps
from datetime import datetime
import json

# change online users to within channel only


app = Flask(__name__)
app.config["SECRET_KEY"] = "this is my secret key"
socketio = SocketIO(app)

# global variables
channel_list = [] # list of channels
"""a dictionary of channels that contain a list of the messages for that channel, 
which are dictionaries and contain the text, author, and timestamp"""
channel_messages = {} 
users = [] # list of registered users
channel_users = {} # dictionary of channels that each contain a list of users


@app.route('/')
def index():
    return render_template('index.html', current_channel="Home", channels=channel_list)

@socketio.on("logged in") 
def logged_in(data):
    # adding users to server
    name = data['name']
    session['name'] = name
    if name not in users:
        users.append(name)
    join_room(session['name']) # personal room
    session['current_channel']=''
    emit('returning user', room=session['name'])

@socketio.on("change channels")
def change_channels(data):
    # making sure requested channel exists, redirecting home otherwise
    print("change channels")
    requested_channel = data['channel']
    if requested_channel in channel_list and requested_channel != "index": # channel exists
        # room configuration
        leave_rooms()
        join_room(requested_channel)
        if (session['name'] not in channel_users[requested_channel]): # add to list of channel's users
            channel_users[requested_channel].append(session['name'])
        session['current_channel'] = requested_channel
        emit('update user list', {'channel': requested_channel, 'users': channel_users[requested_channel]}, room=requested_channel)

        if len(channel_messages[requested_channel]) > 100: # only want last 100 messages
            del channel_messages[requested_channel][0]
        message_list = json.dumps(channel_messages[requested_channel])
        emit('load channel', {'channel': requested_channel, 'channels': channel_list, 'messages': message_list, 'users': channel_users[requested_channel]}, room=requested_channel)
    else: # requested channel doesn't exist
        leave_rooms()
        emit('redirect home', room=session['name'])

@socketio.on("go home")
def go_home():
    # go to home page
    session['current_channel'] = ''
    if ('name' in session): # check if logged in
        leave_rooms()
        emit('at home', {'channels': channel_list, 'users': users}, room=session['name'])
    else:
        emit('at home')
    return redirect(url_for('index'))

@socketio.on("new channel")
def create_channel(data):
    # create a new channel, add to server
    new_channel = data['new-channel']
    if new_channel in channel_list:
        # existing already, join it
        emit('join channel', {'channel': new_channel})
    elif session['name']:
        channel_list.append(new_channel) # add to server memory
        channel_users[new_channel] = []
        welcome_msg = 'Welcome to ' + new_channel + '!'
        channel_messages[new_channel] = [{'message': welcome_msg, 'author': 'Wack-Bot'}]
        print("Channels:" + str(channel_list))

        emit('add to channel list', {'channels': channel_list}, broadcast=True)
        emit('join channel', {'channel': new_channel}, room=session['name'])


@socketio.on("send message")
def send_message(data):
    messageData = {'message': data['message'], 'author': data['name'], 'timestamp': data['timestamp']} # message data
    channel_messages[data['channel']].append(messageData) # add message to server-side memory
    emit('display new message', {'author': data['name'], 'message': data['message'], 'timestamp': data['timestamp']}, room=data['channel'])

# leaves all the rooms user is in
def leave_rooms():
    room_list = rooms()
    for room in room_list:
        if (room != session['name']): # don't leave personal room
            leave_room(room)
            if (session['current_channel'] !=''): # not empty
                room_name = session['current_channel']
                channel_users[room_name].remove(session['name'])
                print("USERS IN " + room_name + ": " + str(channel_users[room_name]))
                emit('update user list', {'users': channel_users[room_name]}, room=room_name)
                print(session['name'] + " has left the room " + room_name)

if __name__ == '__main__':
    # reloading templates when testing
    app.jinja_env.auto_reload = True
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.run(debug=True)