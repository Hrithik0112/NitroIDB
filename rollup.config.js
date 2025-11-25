import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const formats = process.env.FORMAT || 'esm';

const getConfig = (format) => {
  const output = {
    esm: {
      file: 'dist/esm/index.js',
      format: 'es',
      sourcemap: true,
    },
    cjs: {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    iife: {
      file: 'dist/iife/index.js',
      format: 'iife',
      name: 'NitroIDB',
      sourcemap: true,
    },
  };

  return {
    input: 'src/index.ts',
    output: {
      ...output[format],
      // Enable tree-shaking
      generatedCode: {
        constBindings: true,
      },
    },
    plugins: [
      nodeResolve({
        browser: format === 'iife',
        preferBuiltins: false,
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
      }),
    ],
    external: format !== 'iife' ? (id) => !id.startsWith('.') && !id.startsWith('/') : [],
    // Enable tree-shaking
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      tryCatchDeoptimization: false,
    },
  };
};

export default formats === 'all'
  ? ['esm', 'cjs', 'iife'].map(getConfig)
  : getConfig(formats);

