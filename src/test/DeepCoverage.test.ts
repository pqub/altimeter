import { expect } from 'chai';
import * as sinon from 'sinon';
import { CacheManager } from '../core/CacheManager';
import { WindowsStrategy, UnixStrategy } from '../core/strategies';
import { logger } from '../core/Logger';
import { StatsFormatter } from '../services/StatsFormatter';

suite('Deep Coverage Test Suite', () => {
	suite('CacheManager', () => {
		let cacheManager: CacheManager;
		const mockStats: any = {
			totalInputTokens: 100,
			totalOutputTokens: 50,
			totalCacheReadTokens: 10,
			cacheEfficiency: 9,
			totalCalls: 1,
			modelBreakdown: [],
			lastContextSize: 0,
		};

		setup(() => {
			cacheManager = new CacheManager();
		});

		test('should start empty', () => {
			expect(cacheManager.get()).to.be.null;
			expect(cacheManager.isValid('id1')).to.be.false;
			expect(cacheManager.getInfo()).to.equal('Cache: empty');
		});

		test('should store and retrieve stats', () => {
			cacheManager.set('id1', 'time1', mockStats, 0, 0);
			expect(cacheManager.get()).to.deep.equal(mockStats);
			expect(cacheManager.isValid('id1')).to.be.true;
		});

		test('should invalidate cache', () => {
			cacheManager.set('id1', 'time1', mockStats, 0, 0);
			cacheManager.invalidate();
			expect(cacheManager.get()).to.be.null;
		});
	});

	suite('Platform Strategies', () => {
		test('WindowsStrategy should generate CIM command', () => {
			const strategy = new WindowsStrategy();
			const cmd = strategy.getProcessListCommand('proc');
			expect(cmd).to.contain('Win32_Process');
		});

		test('UnixStrategy should generate ps command', () => {
			const strategy = new UnixStrategy('linux');
			const cmd = strategy.getProcessListCommand('proc');
			expect(cmd).to.contain('ps -ww');
		});

		test('UnixStrategy should parse ps output', () => {
			const strategy = new UnixStrategy('linux');
			const stdout =
				'123 456 --app_data_dir antigravity --extension_server_port 3000 --csrf_token abc\n';
			const results = strategy.parseProcessInfo(stdout);
			expect(results).to.have.lengthOf(1);
			expect(results[0].pid).to.equal(123);
		});
	});

	suite('Logger', () => {
		let consoleSpy: sinon.SinonSpy;

		setup(() => {
			consoleSpy = sinon.spy(console, 'log');
			logger.init();
		});

		teardown(() => {
			consoleSpy.restore();
		});

		test('should log info messages', () => {
			logger.info('test info');
			expect(consoleSpy.calledOnce).to.be.true;
			expect(consoleSpy.firstCall.args[0]).to.contain('[INFO] test info');
		});
	});

	suite('StatsFormatter', () => {
		test('should format trend table', () => {
			const rows = [{ date: '2026-01-01', input: 100, output: 50, cache: 10 }];
			const result = StatsFormatter.formatTrendTable('Title', rows);
			expect(result).to.contain('2026-01-01');
			expect(result).to.contain('10%');
		});
	});
});
