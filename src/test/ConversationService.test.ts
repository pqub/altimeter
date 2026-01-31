import { expect } from 'chai';
import sinon from 'sinon';
import { ConversationService } from '../services/ConversationService';
import { LSClient } from '../core/LSClient';

suite('ConversationService Test Suite', () => {
	let clientStub: sinon.SinonStubbedInstance<LSClient>;
	let service: ConversationService;

	setup(() => {
		clientStub = sinon.createStubInstance(LSClient);
		service = new ConversationService(clientStub as unknown as LSClient);
	});

	test('should fetch and sort conversations by lastModifiedTime', async () => {
		const mockResponse = {
			trajectorySummaries: {
				id1: {
					cascadeId: 'id1',
					summary: 'Older',
					lastModifiedTime: '2026-01-30T10:00:00Z',
					stepCount: '5',
				},
				id2: {
					cascadeId: 'id2',
					summary: 'Newer',
					lastModifiedTime: '2026-01-30T11:00:00Z',
					stepCount: '10',
				},
			},
		};

		clientStub.getAllCascadeTrajectories.resolves(mockResponse);

		const conversations = await service.fetchSortedConversations();

		expect(conversations).to.have.lengthOf(2);
		expect(conversations[0].cascadeId).to.equal('id2'); // Newer first
		expect(conversations[1].cascadeId).to.equal('id1');
		expect(conversations[0].stepCount).to.equal(10);
	});

	test('should handle empty response', async () => {
		clientStub.getAllCascadeTrajectories.resolves({});

		const conversations = await service.fetchSortedConversations();
		expect(conversations).to.be.an('array');
		expect(conversations.length).to.equal(0);
	});

	test('should get the latest conversation', async () => {
		const mockResponse = {
			trajectorySummaries: {
				id1: { lastModifiedTime: '2026-01-30T10:00:00Z' },
				id2: { lastModifiedTime: '2026-01-30T12:00:00Z' },
			},
		};

		clientStub.getAllCascadeTrajectories.resolves(mockResponse);

		const latest = await service.getLatestConversation();
		expect(latest?.lastModifiedTime).to.equal('2026-01-30T12:00:00Z');
	});

	test('should return null for latest when no conversations exist', async () => {
		clientStub.getAllCascadeTrajectories.resolves({});

		const latest = await service.getLatestConversation();
		expect(latest).to.equal(null);
	});
});
