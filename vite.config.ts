import { defineConfig } from 'vite';

// base relativa: o mesmo build funciona em localhost e em https://<usuário>.github.io/barra-adentro/
import pkg from './package.json';

export default defineConfig({ base: './', define: { __VERSAO__: JSON.stringify(pkg.version) } });
