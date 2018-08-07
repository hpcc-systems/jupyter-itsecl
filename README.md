# ITSECL

ITSECL is a Typescript/ECL kernel for the [Jupyter notebook](http://jupyter.org/)...
It provides a prototype implementation of HPCC ECL for Jupyter Notebook by referencing [ITypeScript](https://github.com/nearbydelta/itypescript)

The HPCC Systems server platform is a free, open source, massively scalable platform for big data analytics. Download the HPCC Systems server platform now and take the reins of the same core technology that LexisNexis has used for over a decade to analyze massive data sets for its customers in industry, law enforcement, government, and science.

For more information and related downloads for HPCC Systems Products, please visit
https://hpccsystems.com


## Installations

Prerequites:
python-dev, python3.5-dev, python-pip python3-pip jupyter nodejs

For example on Ubuntu 16.04 xenial
```sh
sudo apt-get install -y curl git python-dev python3.5-dev python3-pip
sudo pip3 install jupyter
sudo curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs

```
On ubuntu 18.04 replace python3.5-dev with python3.6-dev

Install ITSECL
### Install ITSECL globally
You don't need use "sudo" but it is usually required to configure the npm default directory
```sh
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo "export PATH=~/.npm-global/bin:\$PATH" >> ~/.profile
source ~/.profile
```
If run as root or sudo following probably is needed as root before run npm install
npm config set unsafe-perm true

To install ITSECL:
```sh
npm install -g itsecl
```
To start Jupyter Notebook with TSECL engine:
```sh
itsecl
```

### Install ITSECL locally
In an empty directory
```sh
npm init
npm install itsecl
```

To start Jupyter Notebook with TSECL engine:
```sh
./node_modules/.bin/itsecl
```


### Alternatively way to jupyter notebook

Install itsecl kernel
```sh
itsecl --ts-install=global

# If you want to see itsecl kernel debug message add "--ts-debug"
# To verify ITSECL kernel (jsecl) installed in jupyter:
jupyter kernelspec list. "tsecl" is the kernel name.
```
To run ITSECL in jupyter notebook in your work directory which can be any directory (The Jupyter notebook files will be saved there):
```sh
jupyter notebook

# Or with debug information for tsecl kernel:

itsecl --ts-debug
# Then select kernel "HPCC ECL - TSECL" from "new"
```
To run ITSECL in jupyter console (Currenly support for console is limited. Try to use notebook instead).
```sh
jupyter console --kernel=tsecl
```

## Usage

### Run normal Javascript/Typescript code:
```sh
//JS
var i = 10; i;
```

### Test connection with HPCC esp server

In order to run ECL code you should test connection with HPCC ESP server first
```sh
//CONN  ip=192.168.56.100; port=8010; cluster=hthor; user=<username>; password=<password>;
```
The above connection parameters can be provided from a file
```sh
//CONN  file=/tmp/esp.conf;
```
Sample esp.conf:
```sh
ip=190.29.2.11
port=8018
cluster=thor
user=hpccuser
passwd=mypassword
default=ECL
```

To display the current configuration:
```sh
//CONF
```

### Test connection with HPCC esp server
***This is still under development***

ECL code
```sh
//ECL
OUTPUT("Hello ECL");
```
If default action is set to "ECL", which is default, "//ECL" can be avoid"


To change cluster
```sh
//ECL cluster=roxie;
...
```
## Stop Jupyter Notebook
Clt-C and type 'y'

## Build and Publish

To build
```sh
git clone https://github.com/hpcc-systems/jupyter-itsecl
cd jupyter-itsecl
npm install
tsc
```
*.js files will be generated in bin and lib direcotries.

To publish to npm repository
```sh
npm login
npm publish

## ITSECL Docker Image
For using and building ITSECL Docker Image reference docker/README.md
