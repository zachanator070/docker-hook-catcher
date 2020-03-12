
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

const getContainersToKill = async (image) => {
	return new Promise((resolve, reject) => {
		docker.listContainers(function (err, containers) {
			if(err){
				reject(err);
			}
			let containerSearched = containers.length;
			if (containers.length === 0) {
				reject('No containers running to stop');
			}
			let containersToKill = [];
			for (let containerInfo of containers) {
				console.log(`looking at ${containerInfo.Image}`);
				if (containerInfo.Image === image) {
					console.log('found: ' + JSON.stringify(containerInfo));
					containersToKill.push(containerInfo.Id);

				}
				containerSearched--;
				if (containerSearched === 0) {
					resolve(containersToKill);
				}
			}
		});
	});
};

const getImagesToRemove = async (image) => {
	return new Promise((resolve, reject) => {
		docker.listContainers(function (err, containers) {
			if(err){
				reject(err);
			}
			let containerSearched = containers.length;
			if (containers.length === 0) {
				reject('No containers running to stop');
			}
			let imagesToRemove = [];
			for (let containerInfo of containers) {
				console.log(`looking at ${containerInfo.Image}`);
				if (containerInfo.Image === image) {
					console.log('found: ' + JSON.stringify(containerInfo));
					imagesToRemove.push(containerInfo.ImageID);

				}
				containerSearched--;
				if (containerSearched === 0) {
					resolve(imagesToRemove);
				}
			}
		});
	})
};

const removeImages = async (imageIds) => {
	return new Promise((resolve, reject) => {
		let toRemove = imageIds.length;
		if(toRemove === 0){
			resolve()
		}
		for(let imageId of imageIds){
			const image = docker.getImage(imageId);
			image.remove(() => {
				toRemove--;
				if(toRemove === 0){
					resolve();
				}
			});
		}
	});
};

const pullImage = async (image) => {
	return new Promise((resolve,reject) => {
		docker.pull(image, (err, stream) => {
			stream.on('data', (chunk) => {
				console.log(chunk.toString());
			});
			stream.on('end', () => {
				resolve();
			});
			stream.on('error', (err) => {
				reject(err);
			});
		});
	});
};

const killContainers = async (containerIds) => {
	return new Promise((resolve, reject) => {
		let toKill = containerIds.length;
		if(toKill === 0){
			resolve()
		}
		for(let containerId of containerIds){
			const container = docker.getContainer(containerId);
			container.kill(() => {
				container.remove(() => {
					toKill--;
					if(toKill === 0){
						resolve()
					}
				});
			});
		}
	});
};

const confirmCallBack = async (callback_url) => {
	return new Promise((resolve, reject) => {
		fetch(callback_url, {
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
			resolve();
		});
	})
};

server.post('/restartImage', (req, res) => {
	console.log(JSON.stringify(req.body));
	const image = req.body.repository.repo_name + ':' + req.body.push_data.tag;
	console.log(image);

	(async () => {
		const containersToKill = await getContainersToKill(image);
		const imagesToRemove = await getImagesToRemove(image);
		await pullImage(image);
		await killContainers(containersToKill);
		await removeImages(imagesToRemove);
		await confirmCallBack(req.body.callback_url);
		return res.status(200).json({status: 'success'});
	})().catch((e) => {
		const response = {message: e.message, trace: e.stack};
		console.log(JSON.stringify(response));
		return res.status(500).json({message: e.message, trace: e.stack});
	});
});

server.listen(port, () => {
	console.log(`The server is running and listening at http://localhost:${port}`);
});