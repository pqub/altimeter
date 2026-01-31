/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import { LSClient } from '../core/LSClient';

suite('LSClient Test Suite', () => {
	let axiosStub: sinon.SinonStub;
	let client: LSClient;

	setup(() => {
		// Stub axios.create to return an object with a post method
		axiosStub = sinon.stub(axios, 'create').returns({
			post: sinon.stub(),
			defaults: { headers: {} },
			interceptors: { request: { use: sinon.stub() }, response: { use: sinon.stub() } },
		} as any);

		client = new LSClient(1234, 'mock-token');
	});

	teardown(() => {
		sinon.restore();
	});

	test('should initialize with correct port and token', () => {
		expect(client.port).to.equal(1234);
		expect(client.token).to.equal('mock-token');
		expect(axiosStub.calledOnce).to.be.true;
	});

	test('should make successful requests', async () => {
		const mockResponse = { data: { success: true } };
		const innerClient = (client as any).client;
		innerClient.post.resolves(mockResponse);

		const result = await client.makeRequest('test_method', { foo: 'bar' });

		expect(result.success).to.be.true;
		expect(innerClient.post.calledWith('/test_method', { foo: 'bar' })).to.be.true;
	});

	test('should handle request errors', async () => {
		const innerClient = (client as any).client;
		innerClient.post.rejects(new Error('Network Error'));

		try {
			await client.makeRequest('test_method');
			expect.fail('Should have thrown error');
		} catch (e: any) {
			expect(e.message).to.equal('Network Error');
		}
	});

	test('should fetch all cascade conversations', async () => {
		const innerClient = (client as any).client;
		innerClient.post.resolves({ data: { trajectorySummaries: { id1: { summary: 'Test' } } } });

		const response = await client.getAllCascadeTrajectories();
		expect(response.trajectorySummaries).to.have.property('id1');
	});
});
