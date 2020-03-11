
import express from 'express';
import bodyParser from "body-parser";
import morgan from 'morgan';
import Docker from 'dockerode';
import fetch from 'node-fetch';

const port = process.env.PORT || 7000;

const docker = new Docker({socketPath: '/var/run/docker.sock'});

const server = express();
server.use(bodyParser.json());
server.use(morgan('tiny', {}));

server.post('/restartImage', (req, res) => {

	const image = req.body.repository.repo_name + ':' + req.body.push_data.tag;

	try{
		docker.pull(req.body.image, () => {
			docker.listContainers(function (err, containers) {
				let containerSearched = containers.length;
				let containerFound = false;
				if(containers.length === 0){
					return res.status(404).send('Containers with image not found');
				}
				containers.forEach(function (containerInfo) {

					if(containerInfo.Image === image){
						containerFound = true;
						console.log(JSON.stringify(containerInfo));
						docker.getContainer(containerInfo.Id).stop(() => {
							fetch(req.body.callback_url, {
								method: "post",
								headers: {
									"Content-type": "application/json",
									"Accept": "application/json",
									"Accept-Charset": "utf-8"
								},
								body: JSON.stringify({
									state: "success"
								})
							}).then((response) => {
								return res.json({status: 'success'});
							});
						});
					}
					containerSearched--;
					if(containerSearched===0 && !containerFound){
						return res.status(404).send('Containers with image not found');
					}

				});
			});
		});
	}
	catch(e){
		const response = {message: e.message, trace: e.stack};
		console.log(JSON.stringify(response));
		return res.status(500).json({message: e.message, trace: e.stack})
	}
});

server.listen(port, () => {
	console.log(`The server is running and listening at http://localhost:${port}`);
});