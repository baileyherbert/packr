import { PackrAction } from '../PackrAction';

export class BuildAction extends PackrAction {

	public constructor() {
		super({
			actionName: 'build',
			summary: 'Builds the project',
			documentation: 'Builds the project'
		});
	}

	protected override async onExecute() {

	}

	protected override onDefineParameters() {

	}

}
