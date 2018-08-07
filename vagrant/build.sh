#!/bin/bash

curdir=`pwd`
function cleanup()
{
  vagrant destroy -f
  rm -rf ${curdir}/hld
  exit 1
}

mkdir hld

NAME=jupyter-hpcc-0.1.4
[ -n "$1" ] && NAME=$1

rm -rf ${NAME}.ova

vagrant up || cleanup
vagrant halt || cleanup
vagrant package --out=hld/${NAME}.box || cleanup
vagrant destroy -f

cd hld
tar -xf ${NAME}.box

tar -cf ${NAME}.ova box.ovf box-disk001.vmdk box-disk002.vmdk

cp ${NAME}.ova ../
cd $curdir
rm -rf hld
