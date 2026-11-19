import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const frontend = new URL("../../../srcs/frontend/", import.meta.url);
const requireFromFrontend = createRequire(new URL("package.json", frontend));
const resolveDep = (name: string) => fileURLToPath(new URL(`node_modules/${name}`, frontend));

export default {
  root,
  base: "./",
  cacheDir: "/tmp/opencode/challenge-studio-cache",
  esbuild: { jsx: "automatic" },
  resolve: { alias: { react: resolveDep("react"), "react-dom": resolveDep("react-dom") } },
  css: { postcss: { plugins: [requireFromFrontend("tailwindcss")({ content: [`${root}*.{html,tsx}`] })] } },
};
