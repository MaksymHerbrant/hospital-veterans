import { defineConfig } from 'vite';
export default defineConfig({server:{proxy:{'/wp-content':{target:'http://localhost:3001',changeOrigin:true},'/api':{target:'http://localhost:3001',changeOrigin:true,configure(proxy){proxy.on('proxyReq',(proxyReq,req)=>{if(req.headers.origin)proxyReq.setHeader('origin','http://localhost:3001');});}}}}});
