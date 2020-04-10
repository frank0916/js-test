const http = require("node-fetch");
const base = 'http://rgs-qa21-admin.lab.wagerworks.com/cfgs/ui/api';
const svrName = 'AutoTest';
const svrIp = '199.199.199.10';
const newName = 'newName';
const newIp = '199.199.199.11';
const delay = 500;

let operatorCode = '100';
let verifyProxies = false;

let token = null;
let start = 0;

const sleep = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const rest = async (url: String, options: any) => {
  start = Date.now();
  return http(url, options);
}

async function login() {
  const url = base + '/login';
  return await rest(
    url,
    {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        {
          'username': 'super',
          'password': 'password'
        }
      )
    }
  );
}

const getProxies = async () => {
  const url = base + '/operators/' + operatorCode + '/proxyServers';
  const response = await rest(
    url,
    {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Authorization': token
      }
    }
  );
  if (verifyProxies) {
    expect(response.status).toEqual(200);
    expect(Date.now() - start).toBeLessThan(10000);
  }
  const body = await response.json();
  return body;
}

const addServer = async (id: String, name: String, ip: String) => {
  const url = base + '/operators/' + operatorCode + '/proxyServer';
  return await rest(
    url,
    {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify(
        {
          'serverId': id == null ? 'anything' : id,
          'serverIpAddress': ip == null ? svrIp : ip,
          "serverName": name == null ? svrName : name
        }
      )
    }
  );
}

const updateServer = async (
  serverId: String,
  serverName: String,
  serverIpAddress: String
  ) => {
  const url = base + '/operators/' + operatorCode + '/proxyServer';
  const response = await rest(
    url,
    {
      method: 'PUT',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify(
        {
          'serverId': serverId,
          'serverIpAddress': serverIpAddress,
          "serverName": serverName
        }
      )
    }
  );
  return response;
}

const deleteServer = async (serverId: String) => {
  const url = base + '/operators/' + operatorCode + '/proxyServer?' +
    'serverId=' + serverId;
  const response = await rest(
    url,
    {
      method: 'DELETE',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Authorization': token
      }
    }
  );
  return response;
}

const clear = async () => {
  // delete proxies if server name or ip match preset values
  let proxies = await getProxies();
  for (const p of proxies) {
    if (p.serverName.startsWith(svrName) ||
      p.serverName.startsWith(newName) ||
      p.serverIpAddress.startsWith(svrIp) ||
      p.serverIpAddress.startsWith(newIp)) {
        await deleteServer(p.serverId);
    }
  }
}

const countProxy = async (
  serverId: String,
  serverName: String,
  serverIp: String) => {
  const proxies = await getProxies();
let count = 0;
for (const p of proxies) {
  if (p.serverId == serverId ||
    p.serverName == serverName ||
    p.serverIpAddress == serverIp) {
      count++;
  }
}
return count;
}

const matchoProxies = async (list: any) => {
  const proxies = await getProxies();
  const one = JSON.stringify(proxies.sort((a: { serverId: number; },b: { serverId: number; }) => {a.serverId - b.serverId}));
  const two = JSON.stringify(list.sort((a: { serverId: number; },b: { serverId: number; }) => {a.serverId - b.serverId}));
  return one == two;
}

const getServerId = (proxies : any, name: String, ip: String) => {
  for (const p of proxies) {
    if (p.serverName == name || p.serverIpAddress == ip) {
      return p.serverId;
    }
  }
  return null;
}

describe('OperatorService', () => {
  beforeEach(async (done) => {
    operatorCode = '100';
    verifyProxies = false;
    if (!token) {
      let response = await login();
      let body = await response.json();
      token = body.token;
    }
    clear();
    done();
  });

  afterEach((done) => {
    (async function () {
      clear();
      done();
    })();
  });

  it('should preliminary add, update, delete, query proxy', (done) => {
    (async function () {
      await sleep(delay);
      let proxies = await getProxies();
      let count = proxies.length;

      // add new server
      let response = await addServer('anything', svrName, svrIp);
      expect(Date.now() - start).toBeLessThan(10000);
      expect(response.status).toEqual(201);
      count++;

      // check new sever is successfully added
      proxies = await getProxies();
      expect(Date.now() - start).toBeLessThan(10000);
      expect(proxies.length).toEqual(count);
      let svrId = null;
      for (p of proxies) {
        if (p.serverName == svrName && p.serverIpAddress == svrIp) {
          svrId = p.serverId;
        }
      }
      expect(svrId).not.toBeNull();

      // update server name and ip
      response = await updateServer(svrId, newName, newIp);
      expect(Date.now() - start).toBeLessThan(10000);
      expect(response.status).toEqual(200);

      proxies = await getProxies();
      expect(proxies.length).toEqual(count);
      expect(await countProxy(svrId, newName, newIp)).toEqual(1);

      // delete server
      response = await deleteServer(svrId);
      expect(Date.now() - start).toBeLessThan(10000);
      expect(response.status).toEqual(200);
      count--;
      expect(await countProxy(svrId, newName, newIp)).toEqual(0);

      let found = false;
      proxies = await getProxies();
      expect(proxies.length).toEqual(count);
      for (var i = 0; i < proxies.length; i++) {
        var p = proxies[i];
        if (p.serverId == svrId || p.serverName == svrName ||
          p.serverIpAddress == svrIp) {
          found = true;
        }
      }

      // verify server is deleted
      expect(found).toBeFalse();

      done();
    })();
  });

  function chkMsg(msg: String, s: string) {
    return(msg.startsWith('The proxy server')
      && msg.endsWith('is already existed for this operator')
      && msg.includes(s));
  }

  

  it('should add a new server to proxy list', (done) => {
    (async function () {
      await sleep(delay);
      let proxies = await getProxies();
      let count = proxies.length;
      // add first server
      let response = await addServer('anything', svrName, svrIp);
      expect(Date.now() - start).toBeLessThan(10000);
      expect(response.status).toEqual(201);
      count++;

      // check new sever is successfully added
      proxies = await getProxies();
      expect(proxies.length).toEqual(count);
      const svrId = getServerId(proxies, svrName, svrIp);
      expect(svrId).not.toBeNull();

      // try to add a server with duplicated name and ip
      response = await addServer('anything', svrName, newIp);
      expect(Date.now() - start).toBeLessThan(10000);
      expect(response.status).toEqual(400);
      let msg = await response.json();
      expect(msg.error).toEqual("INPUT_ERROR");
      expect(chkMsg(msg.message, 'name')).toBeTrue();
      expect(await matchoProxies(proxies)).toBeTrue();

      // try to add a server with duplicated ip
      response = await addServer('anything', newName, svrIp);
      expect(response.status).toEqual(400);
      msg = await response.json();
      expect(msg.error).toEqual("INPUT_ERROR");
      expect(chkMsg(msg.message, 'ip address'));
      expect(await matchoProxies(proxies)).toBeTrue();

      // try to add a server with duplicated name
      response = await addServer('anything', svrName, svrIp);
      expect(response.status).toEqual(400);
      msg = await response.json();
      expect(msg.error).toEqual("INPUT_ERROR");
      expect(chkMsg(msg.message, 'name') ||
        chkMsg(msg.message, 'ip address')).toBeTrue();
      expect(await matchoProxies(proxies)).toBeTrue();

      done();
    })();
  });

  it('should delete existing proxy in proxy list', (done) => {
    (async function () {
      await sleep(delay);
      let proxies = await getProxies();
      // add new server
      let response = await addServer('anything', svrName, svrIp);
      expect(response.status).toEqual(201);

      response = await addServer('anything', newName, newIp);
      expect(response.status).toEqual(201);

      proxies = await getProxies();

      const svrId = getServerId(proxies, svrName, svrIp);
      const newSvrId = getServerId(proxies, newName, newIp);

      response = await deleteServer(newSvrId);
      expect(response.status).toEqual(200);

      response = await deleteServer(svrId);
      expect(response.status).toEqual(200);

      done();
    })();
  });



  it('should catch invalid server name and ip errors', (done) => {
    (async function () {
      await sleep(delay);

      await addServer('anything', svrName, svrIp);
      await addServer('anything', newName, newIp);

      let proxies = await getProxies();
      const proxies0 = proxies;

      const newId = await getServerId(proxies, newName, newIp);

      let response = await updateServer(newId, svrName, svrIp);
      expect(Date.now() - start).toBeLessThan(10000);
      expect(response.status).toEqual(400);
      let msg = await response.json();
      expect(msg.error).toEqual("INPUT_ERROR");
      expect(await matchoProxies(proxies)).toBeTrue();

      response = await updateServer(newId, svrName, newIp);
      expect(Date.now() - start).toBeLessThan(10000);
      expect(response.status).toEqual(400);
      expect(await matchoProxies(proxies)).toBeTrue();

      response = await updateServer(newId, svrName, newIp);
      expect(Date.now() - start).toBeLessThan(10000);
      expect(response.status).toEqual(400);
      expect(await matchoProxies(proxies)).toBeTrue();

      proxies = await getProxies();
      response = await updateServer(newId, newName+'0', newIp+'0');
      expect(response.status).toEqual(200);
      proxies = await getProxies();
      expect(Date.now() - start).toBeLessThan(10000);
      expect(await matchoProxies(proxies)).toBeTrue();
      expect(await countProxy(newId, newName+'0', newIp+'0')).toEqual(1);

      proxies = await getProxies();
      response = await updateServer(newId, newName, newIp);
      expect(Date.now() - start).toBeLessThan(10000);
      expect(response.status).toEqual(200);
      expect(await matchoProxies(proxies0)).toBeTrue();

      done();
    })();
  });
 
  it('should change server list after add, delete, update server', (done) => {
    (async function () {
      await sleep(delay);
      verifyProxies = true;
      const proxies0 = await getProxies();

      let count = proxies0.length;
      let response = await addServer('anything', svrName, svrIp);

      const proxies1 = await getProxies();

      expect(proxies1.length - proxies0.length).toEqual(1);
      let svrId1 = await getServerId(proxies1, svrName, svrIp);

      response = await addServer('anything', newName, newIp);

      const proxies2 = await getProxies();
      expect(proxies2.length - proxies1.length).toEqual(1);

      let svrId2 = await getServerId(proxies2, newIp, newIp);
      expect(await countProxy(svrId1, svrIp, svrName)).toEqual(1);
      expect(await countProxy(svrId2, newIp, newIp)).toEqual(1);
      
      await updateServer(svrId2, newName+'0', newIp+'0');
      expect(await countProxy(svrId2, newIp+'0', newName+'0')).toEqual(1);
      expect(await matchoProxies(proxies2)).toBeFalse();

      await deleteServer(svrId2);
      expect(await matchoProxies(proxies1)).toBeTrue();

      await deleteServer(svrId1);
      expect(await matchoProxies(proxies0)).toBeTrue();

      done();
    })();
  });

  it('should return empty list for incorrect operator code', (done) => {
    (async function () {
      await sleep(delay);

      let operatorCodes = ['0', 'a', '@', '!', '777777', '%^&'];
      for (let opCode of operatorCodes) {
        let proxies = null;
        try {
          proxies = await getProxies();
          expect(proxies == null || proxies.length == 0).toBeTrue();
        } catch (error) {
          fail("exception caught for invalid operator code " + opCode);
          console.log(error);
        }
      }
      done();
    })();
  });

});
