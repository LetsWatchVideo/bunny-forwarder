const config = {
	'apiURL': process.env.API_URL || 'https://api.letswatch.video',
	'jwtSecret': process.env.JWT_SECRET || 'secret'
};

const httpServer = require('http');
const micro = require('micro')
const ioServer = require('socket.io');
const fetch = require('node-fetch');

const jwt = require('jsonwebtoken');
var app = new httpServer(micro(async (req, res) => {
	const { d } = req.params,
		{ name, password } = jwt.verify(d, config.jwtSecret);
	console.log(req.params, name, password);
	// Verify that this is valid streamer
	if (!name || !password) socket.disconnect(true);
	// We want to keep the connection always open
	res.connection.setTimeout(0);

	req.on('data', data => {
		// Send to all client except sender
		return socket.broadcast.send(data);
	});
}));

// Websocket server
let socket = ioServer(app).of('stream');
socket.on('connection', async (socket) => {
	const params = socket.handshake.query;
	console.log(params);
	const { d } = params;
	const { name } = jwt.verify(d, config.jwtSecret);
	console.log(name);
	// Verify that the room exists
	const room = await fetch(
		`${config.apiURL}/room`,
		{
			body: {
				name
			}
		}
	);
	if (!room) return socket.disconnect(true);

	socket.on('message', data => console.log('New websocket message:', data))
	socket.on('close', () => console.log('Disconnected from websocket'))
});

// Remote control server
let remote = ioServer(app).of('remote');
remote.on('connection', function (socket) {
	const params = socket.handshake.query;

	socket.use(async (socket, next) => {
		if (params && params.password) {
			try {
				const response = await fetch(
					`${config.apiURL}/room/remote`,
					{
						body: {
							password: params.password
						}
					}
				);
				if (response.status === 200) next();
			} catch (error) {
				console.log(error);
				next(new Error('Authentication error'));
			}

		} else {
			next(new Error('Authentication error'));
		}
	})
	.on('message', () => {
		// Send message to everyone but ourselves
		socket.broadcast.emit('message', message);
	})
});