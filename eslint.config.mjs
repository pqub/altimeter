import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ["out/", "dist/", "**/*.d.ts", "webview-ui/"]
    },
    {
        files: ["src/**/*.ts", "src/**/*.tsx"],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/naming-convention": [
                "warn",
                {
                    "selector": "import",
                    "format": ["camelCase", "PascalCase"]
                }
            ],
            "curly": "warn",
            "eqeqeq": "warn",
            "no-throw-literal": "warn",
            "@typescript-eslint/no-explicit-any": "off"
        }
    }
);
