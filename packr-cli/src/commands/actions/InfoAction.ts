import { PackrAction } from '../PackrAction';

export class InfoAction extends PackrAction {

	public constructor() {
		super({
			actionName: 'info',
			summary: 'Shows information about a bundle',
			documentation: 'Shows information about a bundle'
		});
	}

	protected override async onExecute() {

	}

	protected override onDefineParameters() {

	}

}
