import 'kleur/colors';
import { i as decodeKey } from './chunks/astro/server_DbS2FUvM.mjs';
import 'clsx';
import 'cookie';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/astro-designed-error-pages_DSHDS0xF.mjs';
import 'es-module-lexer';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///home/jared/blog/blog/","cacheDir":"file:///home/jared/blog/blog/node_modules/.astro/","outDir":"file:///home/jared/blog/blog/dist/","srcDir":"file:///home/jared/blog/blog/src/","publicDir":"file:///home/jared/blog/blog/public/","buildClientDir":"file:///home/jared/blog/blog/dist/client/","buildServerDir":"file:///home/jared/blog/blog/dist/server/","adapterName":"@astrojs/vercel","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"galaxity-learning/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/galaxity-learning","isIndex":false,"type":"page","pattern":"^\\/galaxity-learning\\/?$","segments":[[{"content":"galaxity-learning","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/galaxity-learning.astro","pathname":"/galaxity-learning","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"resources/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/resources","isIndex":false,"type":"page","pattern":"^\\/resources\\/?$","segments":[[{"content":"resources","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/resources.astro","pathname":"/resources","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/analytics/visit","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/analytics\\/visit\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"analytics","dynamic":false,"spread":false}],[{"content":"visit","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/analytics/visit.ts","pathname":"/api/analytics/visit","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"inline","content":"body{font-feature-settings:\"liga\",\"tnum\",\"case\",\"calt\",\"zero\",\"ss01\",\"locl\";text-rendering:optimizelegibility;-webkit-font-smoothing:antialiased;-webkit-overflow-scrolling:touch;-webkit-text-size-adjust:100%;scroll-behavior:smooth;font-family:-apple-system,BlinkMacSystemFont,Iosevka Aile,Roboto,Segoe UI,Helvetica,Arial,sans-serif;margin:auto;padding:20px;max-width:65ch;text-align:left;background-color:#14141d;word-wrap:break-word;overflow-wrap:break-word;line-height:1.5;color:#dce1ff}pre.astro-code{padding:1rem;border-radius:.5rem;overflow:auto}.nav{display:flex;flex:auto;gap:1rem}a,a:visited,a:hover,a:active{color:#51f9ff;text-decoration:none}a.active{text-decoration:underline;font-weight:700}.main{margin-top:2rem}.section{margin-top:3rem}.timeline-section{margin-top:2.5rem}.timeline-list{list-style:none;margin:1rem 0 0;padding:0}.timeline-item{position:relative;padding-left:1.1rem;margin-bottom:1.25rem}.timeline-month{font-weight:600;margin:0;letter-spacing:.01em}.timeline-item:before{content:\"\";position:absolute;left:0;top:.55rem;width:.45rem;height:.45rem;border-radius:999px;background:#51f9ff}.timeline-events{border-left:2px solid #3a3f5a;margin-left:.2rem;margin-top:.4rem;padding-left:.8rem}.timeline-events ul{margin:0;padding-left:1rem}.timeline-events li{margin-bottom:.35rem}.timeline-empty{margin:0;min-height:1.2rem}img{max-width:100%;height:auto;display:block}.pfp-img{border-radius:50%;width:60px;height:60px;object-fit:cover}.img-wrapper{display:flex;align-items:center;gap:1rem}.img-wrapper h2{font-size:1.5rem}.galaxity-intro{margin-top:2rem}.galaxity-intro h1{margin-bottom:.75rem}.galaxity-intro p{font-size:1.05rem}.galaxity-gallery{display:grid;gap:1.5rem;margin-top:2rem}.galaxity-gallery figure{margin:0}.galaxity-gallery img{width:100%;border:1px solid #3a3f5a;border-radius:8px}body.traffic-page{max-width:1100px}.traffic-header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.5rem}.traffic-header h1{margin:0;font-size:2rem}.traffic-kicker{color:#9aa4cf;font-size:.85rem;letter-spacing:.08em;margin:0 0 .25rem;text-transform:uppercase}.traffic-metrics{display:grid;gap:.75rem;grid-template-columns:repeat(4,minmax(0,1fr));margin:0 0 1rem}.traffic-metrics article,.traffic-panel{background:#1a1b27;border:1px solid #343951;border-radius:8px}.traffic-metrics article{padding:1rem}.traffic-metrics span,.traffic-meta,.traffic-recent small{color:#9aa4cf}.traffic-metrics strong{display:block;font-size:2rem;line-height:1.1;margin-top:.35rem}.traffic-meta{display:flex;flex-wrap:wrap;gap:.5rem 1rem;font-size:.9rem;margin-bottom:1.25rem}.traffic-grid{display:grid;gap:1rem;grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:1rem}.traffic-panel{overflow:auto;padding:1rem}.traffic-panel h2{font-size:1rem;margin:0 0 .75rem}.traffic-panel table{border-collapse:collapse;min-width:100%}.traffic-panel th,.traffic-panel td{border-top:1px solid #2a2f45;padding:.55rem .35rem;text-align:left;vertical-align:top;white-space:nowrap}.traffic-panel td{color:#dce1ff}.traffic-panel th{color:#dce1ff;font-weight:500}.traffic-panel td:last-child{text-align:right}.traffic-recent{margin-bottom:2rem}.traffic-recent small{display:block;font-size:.78rem;margin-top:.15rem}@media(max-width:800px){.traffic-header{align-items:start;flex-direction:column}.traffic-metrics,.traffic-grid{grid-template-columns:1fr}}\n"}],"routeData":{"route":"/private/traffic","isIndex":false,"type":"page","pattern":"^\\/private\\/traffic\\/?$","segments":[[{"content":"private","dynamic":false,"spread":false}],[{"content":"traffic","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/private/traffic.astro","pathname":"/private/traffic","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/home/jared/blog/blog/src/pages/galaxity-learning.astro",{"propagation":"none","containsHead":true}],["/home/jared/blog/blog/src/pages/private/traffic.astro",{"propagation":"none","containsHead":true}],["/home/jared/blog/blog/src/pages/resources.astro",{"propagation":"none","containsHead":true}],["/home/jared/blog/blog/src/pages/writings/[slug].astro",{"propagation":"in-tree","containsHead":true}],["/home/jared/blog/blog/src/pages/index.astro",{"propagation":"in-tree","containsHead":true}],["\u0000astro:content",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/index@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astrojs-ssr-virtual-entry",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/writings/[slug]@_@astro",{"propagation":"in-tree","containsHead":false}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000noop-actions":"_noop-actions.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/api/analytics/visit@_@ts":"pages/api/analytics/visit.astro.mjs","\u0000@astro-page:src/pages/galaxity-learning@_@astro":"pages/galaxity-learning.astro.mjs","\u0000@astro-page:src/pages/private/traffic@_@astro":"pages/private/traffic.astro.mjs","\u0000@astro-page:src/pages/resources@_@astro":"pages/resources.astro.mjs","\u0000@astro-page:src/pages/writings/[slug]@_@astro":"pages/writings/_slug_.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_DQJ8T5qg.mjs","/home/jared/blog/blog/node_modules/astro/dist/assets/services/sharp.js":"chunks/sharp_goBMVSSU.mjs","/home/jared/blog/blog/.astro/content-assets.mjs":"chunks/content-assets_DJ-MUfhU.mjs","/home/jared/blog/blog/.astro/content-modules.mjs":"chunks/content-modules_Dz-S_Wwv.mjs","\u0000astro:data-layer-content":"chunks/_astro_data-layer-content_osb6lB-c.mjs","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/tweet-trival.CP6mOpLj.png","/_astro/repo.IrgMmlWr.png","/IMG_5416.PNG","/IMG_5417.PNG","/IMG_5418.PNG","/IMG_5419.PNG","/IMG_5423.PNG","/IMG_5424.PNG","/IMG_5426.PNG","/favicon.svg","/galaxity-full-screen.jpg","/jared-black-bg.png","/galaxity-learning/index.html","/resources/index.html","/index.html"],"buildFormat":"directory","checkOrigin":true,"allowedDomains":[],"serverIslandNameMap":[],"key":"PAfqGjOl+JTQenXhFsaOARmXgO0a1syqNCvePtSCJws="});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = null;

export { manifest };
