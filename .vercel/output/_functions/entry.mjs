import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_C2WB2rU5.mjs';
import { manifest } from './manifest_DQJ8T5qg.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/api/analytics/visit.astro.mjs');
const _page2 = () => import('./pages/galaxity-learning.astro.mjs');
const _page3 = () => import('./pages/private/traffic.astro.mjs');
const _page4 = () => import('./pages/resources.astro.mjs');
const _page5 = () => import('./pages/writings/_slug_.astro.mjs');
const _page6 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/api/analytics/visit.ts", _page1],
    ["src/pages/galaxity-learning.astro", _page2],
    ["src/pages/private/traffic.astro", _page3],
    ["src/pages/resources.astro", _page4],
    ["src/pages/writings/[slug].astro", _page5],
    ["src/pages/index.astro", _page6]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./_noop-actions.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "53dbf361-0e75-40d6-bea8-36c9c5644589",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };
