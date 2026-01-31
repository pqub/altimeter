import { expect } from 'chai';
import sinon from 'sinon';
import { ProcessHunter } from '../core/ProcessHunter';
import * as process from 'process';

suite('ProcessHunter Test Suite', () => {
	let mockExec: sinon.SinonStub;

	setup(() => {
		mockExec = sinon.stub();
	});

	teardown(() => {
		sinon.restore();
	});

	test('should initialize with correct strategy for platform', () => {
		const hunter = new ProcessHunter(mockExec);
		expect(hunter).to.be.instanceOf(ProcessHunter);
		// Internal strategy is private, but we can check if it initialized.
	});

	// NOTE: Testing the full scanEnvironment requires a lot of mocking (exec, https.request).
	// For now we test that it attempts to scan.

	test('should attempt process scan', async () => {
		const hunter = new ProcessHunter(mockExec);

		// Mocking the strategy's command output for Linux
		if (process.platform !== 'win32') {
			// ps -ww -eo pid,ppid,args output mock
			const mockOutput = ` 12345      1 language_server_linux --extension_server_port 5678 --csrf_token mock-token --app_data_dir antigravity`;

			// execStub uses callback (error, {stdout, stderr})
			mockExec.resolves({ stdout: mockOutput, stderr: '' });

			// We also need to mock identityPorts and pingPort to avoid real IO
			sinon.stub(hunter as any, 'identifyPorts').resolves([8888]);
			sinon.stub(hunter as any, 'pingPort').resolves(true);

			const result = await hunter.scanEnvironment(1);

			expect(result).to.not.be.null;
			expect(result?.connectPort).to.equal(8888);
			expect(result?.csrfToken).to.equal('mock-token');
		}
	});
});
