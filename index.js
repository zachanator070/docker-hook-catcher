
import express from 'express';
import bodyParser from "body-parser";
import morgan from 'morgan';
import Docker from 'dockerode';

const targetImageName = process.env.IMAGE_NAME;
const restartCode = process.env.RESTART_CODE;
const port = process.env.PORT || 7000;

const docker = new Docker({socketPath: '/var/run/docker.sock'});

const server = express();
server.use(bodyParser.json());
server.use(morgan('tiny', {}));

server.post('/restartImage', (req, res) => {
	if(req.body.restartCode !== restartCode){
		return res.status(401).send('Restart code invalid');
	}
	if(!req.body.image){
		return res.status(404).send('Image name required');
	}


	try{
		docker.pull(req.body.image, () => {
			docker.listContainers(function (err, containers) {
				let containerSearched = containers.length;
				let containerFound = false;
				if(containers.length === 0){
					return res.status(404).send('Containers with image not found');
				}
				containers.forEach(function (containerInfo) {

					if(containerInfo.Image === req.body.image){
						containerFound = true;
						console.log(JSON.stringify(containerInfo));
						docker.getContainer(containerInfo.Id).stop(() => {
							return res.json({status: 'success'});
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
		return res.status(500).json({message: e.message, trace: e.stack})
	}
});

server.listen(port, () => {
	console.log(`The server is running and listening at http://localhost:${port}`);
});