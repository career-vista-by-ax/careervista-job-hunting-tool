import {request} from 'node:http';

// Keep the public Host check intact when Docker maps a different host port.
const origin=new URL(process.env.CAREERVISTA_PUBLIC_ORIGIN);
const port=process.env.CAREERVISTA_PORT??'4318';
const req=request(`http://127.0.0.1:${port}/api/v1/agent-guide`,{
  headers:{Host:origin.host},timeout:2000,
},res=>{
  res.resume();
  res.on('end',()=>process.exit(res.statusCode===200?0:1));
});
req.on('timeout',()=>req.destroy(new Error('Health check timed out')));
req.on('error',()=>process.exit(1));
req.end();
