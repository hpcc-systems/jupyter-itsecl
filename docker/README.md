# ITSECL Docker Image

## Use ITSECL Docker Image

To run latest ITSECL Docker image:
docker run -t -i --privileged -p 8888:8888 hpccsystems/itsecl /bin/bash

To start jupyter notebook:
  1) get ip of the instance with ifconfig eth0
  2) cd ~/Jupyter
  3) jupyter notebook --no-browser --allow-root --ip=<ip of eth0>
  4) copy the URL in host browser


## Build and Publish ITSECL Docker Image
To build:
  1) Get Dockerfile file
  2) sudo docker build <docker hub project>/<image name>:<version> .
     For example, sudo docker build hpccsystems/itsecl:0.1.4 .


To Publish:
Need probably login to Docker hub:  docker login
docker push <Docker hub project>/<image name>:<version>
For example,  sudo docker push hpccsystems/itsecl:0.1.4
