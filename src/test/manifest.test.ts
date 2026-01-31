import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

suite('Manifest Validation Test Suite', () => {
	const packageJsonPath = path.resolve(process.cwd(), 'package.json');
	let packageJson: any;

	suiteSetup(() => {
		const content = fs.readFileSync(packageJsonPath, 'utf-8');
		packageJson = JSON.parse(content);
	});

	test('should have required extension fields', () => {
		expect(packageJson.name).to.be.a('string').and.not.empty;
		expect(packageJson.displayName).to.be.a('string').and.not.empty;
		expect(packageJson.version).to.match(/^\d+\.\d+\.\d+$/);
		expect(packageJson.publisher).to.be.a('string').and.not.empty;
		expect(packageJson.main).to.be.a('string').and.not.empty;
	});

	test('should have valid VS Code engine version', () => {
		expect(packageJson.engines).to.be.an('object');
		expect(packageJson.engines.vscode).to.be.a('string');
		expect(packageJson.engines.vscode).to.match(/^\^?\d+\.\d+\.\d+$/);
	});

	test('should have activationEvents defined', () => {
		expect(packageJson.activationEvents).to.be.an('array');
		expect(packageJson.activationEvents.length).to.be.greaterThan(0);
	});

	test('should have contributes section with commands', () => {
		expect(packageJson.contributes).to.be.an('object');
		expect(packageJson.contributes.commands).to.be.an('array');
		expect(packageJson.contributes.commands.length).to.be.greaterThan(0);

		// Verify each command has required fields
		packageJson.contributes.commands.forEach((cmd: any) => {
			expect(cmd.command).to.be.a('string').and.not.empty;
			expect(cmd.title).to.be.a('string').and.not.empty;
		});
	});

	test('should have views configured', () => {
		expect(packageJson.contributes.views).to.be.an('object');
		expect(packageJson.contributes.viewsContainers).to.be.an('object');
	});

	test('should have valid repository URL', () => {
		expect(packageJson.repository).to.be.an('object');
		expect(packageJson.repository.url).to.be.a('string');
		expect(packageJson.repository.url).to.include('github.com');
	});

	test('main entry point file should be dist/extension.js', () => {
		expect(packageJson.main).to.equal('./dist/extension.js');
	});
});
