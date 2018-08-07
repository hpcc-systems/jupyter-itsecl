export DEBIAN_FRONTEND=noninteractive
arch=$(arch)
VM_HOSTNAME="jupyter-hpcc-vm"
# Second ethernet card
# For Ubuntu 14.04 is eth1, for Ubuntu 16.04 or later it probably is enp0s8
ETH1=enp0s8

yes Y | ssh-keygen -q -t rsa -N '' -f ~/.ssh/id_rsa

apt-get update
apt-get install -y curl git net-tools
apt-get install -y python-dev python3.5-dev python3-pip apt-utils --fix-missing
pip3 install jupyter


curl -sL https://deb.nodesource.com/setup_8.x | bash -
apt-get install -y nodejs

useradd -s /bin/bash -p "\$6\$TlToC1Ia\$rMHaPDzlX8RIn8t57vFClDpELs7/OuCvzzV.uuIFFOUhftDYaq7Z/VXOINuk1amkDGKo87A/bHzDzeyNOthRE1" hpccdemo
mkdir /home/hpccdemo
chown -R hpccdemo:hpccdemo /home/hpccdemo

# Set up sudo
( cat <<'EOP'
%hpccdemo ALL=NOPASSWD:ALL
EOP
) > /tmp/hpccdemo
chmod 0440 /tmp/hpccdemo
mv /tmp/hpccdemo /etc/sudoers.d/

su - hpccdemo -c "mkdir -p /home/hpccdemo/jupyter"
su - hpccdemo -c "cd /home/hpccdemo/jupyter ; npm install itsecl"


cat > /usr/local/bin/get-ip-address << EOM
#!/bin/sh

i=0
MAX_TRIAL=3
interval=5
RC=
while [ \$i -lt \$MAX_TRIAL ]
do
  i=\$(expr \$i \+ 1)
  RC=\$(/sbin/ifconfig ${ETH1} | grep "inet addr" | grep -v "127.0.0.1" | awk '{ print \$2 }' | awk -F: '{ print \$2 }')
  [ -n "\$RC" ] && break
  sleep \$interval
done
echo \$RC
EOM
chmod a+x /usr/local/bin/get-ip-address


cat > /etc/issue-standard << EOM
Welcome to the Jupyter Notebook for HPCC!

Please use the following credentials to login to the shell.

User: hpccdemo
Pass: hpccdemo


(This user has full passwordless sudo rights.)

To start Jupyter notebook for HPCC
jupyter notebook --no-browser --ip=%IP%
password: hpcc

EOM


cat > /etc/network/if-up.d/issue << EOM
#!/bin/sh
if [ "\$METHOD" = loopback ]; then
    exit 0
fi

# Only run from ifup.
if [ "\$MODE" != start ]; then
    exit 0
fi

export IP=\`/usr/local/bin/get-ip-address\`

hostname ${VM_HOSTNAME}
EOM

chmod a+x /etc/network/if-up.d/issue

cat > /etc/rc.local << EOM
#!/bin/sh -e
IP=\$(/usr/local/bin/get-ip-address)
[ -z "\$IP" ] && dhclient enp0s8
MODE="start"
/etc/network/if-up.d/issue

exit 0
EOM

hostname ${VM_HOSTNAME}
IP=$(/usr/local/bin/get-ip-address)
#cat  /etc/issue-standard > /etc/motd
sed -e "s;%IP%;${IP};" /etc/issue-standard > /etc/motd
sed -e "s;%IP%;${IP};" /etc/issue-standard > /etc/issue

chmod a+x /etc/network/if-up.d/issue

# Uninstall GuestAdditions
ls /opt/VBoxGuestAdditions* > /dev/null 2>&1
if [ $? -eq 0 ]
then
   /opt/VBoxGuestAdditions*/uninstall.sh
   rm -rf /opt/VBoxGuestAdditions*
fi

sed -e "s/\(127\.0\.1\.1\).*/\1 ${VM_HOSTNAME}/" /etc/hosts > /tmp/host_tmp
mv /tmp/host_tmp /etc/hosts
chmod 644 /etc/hosts

su  -c "jupyter notebook --generate-config" - hpccdemo

su -c "jupyter notebook password <<INPUTPASSWD
hpcc
hpcc
INPUTPASSWD" - hpccdemo

#Set jupyter notebook password: hpcc
( cat << EOP
{
  "NotebookApp": {
    "password": "sha1:0f392d788ef8:2331d1d4b05b6af812c1847b183493360441db30"
  }
}
EOP
) > /home/hpccdemo/.jupyter/jupyter_notebook_config.json

chmod 600 /home/hpccdemo/.jupyter/jupyter_notebook_config.json
chown hpccdemo:hpccdemo /home/hpccdemo/.jupyter/jupyter_notebook_config.json
