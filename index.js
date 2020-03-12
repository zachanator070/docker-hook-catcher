
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
	console.log(JSON.stringify(req.body));
	const image = req.body.repository.repo_name + ':' + req.body.push_data.tag;
	console.log(image);
	try{
		docker.listImages((err, images) => {
			const imagesToDelete = [];
			for(let localImage of images){
				let relatedImage = false;
				for(let tag of localImage.repoTags){
					if(tag.split(':'[0] === localImage.split(':'))){
						relatedImage = true;
					}
				}
				if(relatedImage && !localImage.includes(image)){
					imagesToDelete.push(localImage.Id);
				}
			}

			docker.listContainers(function (err, containers) {
				let containerSearched = containers.length;
				if(containers.length === 0){
					return res.status(404).send('No containers running to stop');
				}
				let containerToKill = null;
				for(let containerInfo of containers){
					console.log(`looking at ${containerInfo.Image}`);
					if(containerInfo.Image === image){
						console.log('found: ' + JSON.stringify(containerInfo));
						containerToKill = containerInfo.Id;
					}
					containerSearched--;
					if(containerSearched===0 ){
						docker.pull(image, (err, stream) => {
							stream.on('data', (chunk) => {
								console.log(chunk.toString());
							});
							stream.on('end', () => {
								if(containerToKill !== null ){

									docker.getContainer(containerToKill).kill(() => {
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
											let deletedImages = 0;
											if(imagesToDelete.length === 0){
												return res.json({status: 'success'});
											}
											for(let imageToDelete of  imagesToDelete){
												docker.getImage(imageToDelete).remove(() => {
													deletedImages++;
													if(deletedImages === imagesToDelete.length){
														return res.json({status: 'success'});
													}
												});
											}

										});
									});

								}
								else{
									return res.status(404).send('Containers with image not found');
								}
							});

						});

					}
				}
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