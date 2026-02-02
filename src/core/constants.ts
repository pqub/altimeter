export const TIMING = {
	PROCESS_SCAN_RETRY_MS: 100,
	HTTP_TIMEOUT_MS: 10000,
	PROCESS_CMD_TIMEOUT_MS: 15000,
};

export const PROCESS_NAMES = {
	windows: 'language_server_windows_x64.exe',
	darwin_arm: 'language_server_macos_arm',
	darwin_x64: 'language_server_macos',
	linux: 'language_server_linux',
};

export const LS_ENDPOINTS = {
	GET_ALL_CASCADE_TRAJECTORIES:
		'exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories',
	GET_CASCADE_METADATA:
		'exa.language_server_pb.LanguageServerService/GetCascadeTrajectoryGeneratorMetadata',
	GET_CASCADE_STEPS: 'exa.language_server_pb.LanguageServerService/GetCascadeTrajectorySteps',
	GET_UNLEASH_DATA: 'exa.language_server_pb.LanguageServerService/GetUnleashData',
	GET_USER_STATUS: 'exa.language_server_pb.LanguageServerService/GetUserStatus',
};
