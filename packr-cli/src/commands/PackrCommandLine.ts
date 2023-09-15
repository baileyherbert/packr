import { CommandLineFlagParameter, CommandLineParser } from '@rushstack/ts-command-line';
import { BuildAction } from './actions/BuildAction';
import { ExtractAction } from './actions/ExtractAction';
import { InfoAction } from './actions/InfoAction';
import { PackrGlobals } from './PackrGlobals';
import { LogLevel } from '@baileyherbert/logging';

export class PackrCommandLine extends CommandLineParser {

	private _verbose!: CommandLineFlagParameter;

	public constructor() {
		super({
			toolFilename: 'packr',
			toolDescription: 'A bundler for PHP projects'
		});

		this.addAction(new BuildAction());
		this.addAction(new ExtractAction());
		this.addAction(new InfoAction());
	}

	protected override onDefineParameters() {
		this._verbose = this.defineFlagParameter({
			parameterLongName: '--verbose',
			parameterShortName: '-v',
			description: 'Enable verbose output',
			environmentVariable: 'PACKR_VERBOSE'
		});
	}

	protected override async onExecute() {
		PackrGlobals.logger.createConsoleTransport(
			this._verbose.value ? LogLevel.Trace : LogLevel.Information
		);

		return super.onExecute();
	}

}
