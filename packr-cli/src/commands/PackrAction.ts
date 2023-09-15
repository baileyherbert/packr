import { CommandLineAction } from '@rushstack/ts-command-line';
import { PackrGlobals } from './PackrGlobals';

export abstract class PackrAction extends CommandLineAction {

	/**
	 * The logger for this action.
	 */
	protected readonly logger = PackrGlobals.logger.createChild();

}
