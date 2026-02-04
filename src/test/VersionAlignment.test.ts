import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

suite('Version Alignment Guard', () => {
	test('should have matching VS Code engine and types major.minor version', () => {
		const pkgPath = path.resolve(__dirname, '../../package.json');
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

		const engineVersion = pkg.engines.vscode.replace(/[\^~]/, '');
		const typesSpecifier = pkg.devDependencies['@types/vscode'].replace(/[\^~]/, '');

		const engineParts = engineVersion.split('.');
		const engineMajorMinor = `${engineParts[0]}.${engineParts[1]}`;

		// 1. Check package.json specifier
		const typesParts = typesSpecifier.split('.');
		const typesMajorMinor = `${typesParts[0]}.${typesParts[1]}`;

		expect(engineMajorMinor).to.equal(
			typesMajorMinor,
			`package.json: VS Code engine version (${engineMajorMinor}) must match @types/vscode specifier (${typesMajorMinor}).`,
		);

		// 2. Check pnpm-lock.yaml actual resolved version
		const lockPath = path.resolve(__dirname, '../../pnpm-lock.yaml');
		if (fs.existsSync(lockPath)) {
			const lockContent = fs.readFileSync(lockPath, 'utf8');
			// Look for '@types/vscode': followed by specifier and then version: X.Y.Z
			const typesSectionRegex = /'@types\/vscode':\s+specifier:.*?\n\s+version:\s+([\d.]+)/;
			const match = lockContent.match(typesSectionRegex);

			if (match && match[1]) {
				const resolvedVersion = match[1];
				const resolvedParts = resolvedVersion.split('.');
				const resolvedMajorMinor = `${resolvedParts[0]}.${resolvedParts[1]}`;

				expect(resolvedMajorMinor).to.equal(
					engineMajorMinor,
					`pnpm-lock.yaml: Resolved @types/vscode version (${resolvedMajorMinor}) must match VS Code engine version (${engineMajorMinor}). Update the lockfile!`,
				);
			}
		}
	});
});
