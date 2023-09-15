import { PackrAction } from '../PackrAction';

export class ExtractAction extends PackrAction {

	public constructor() {
		super({
			actionName: 'extract',
			summary: 'Extracts a bundle',
			documentation: 'Extracts a bundle'
		});
	}

	protected override async onExecute() {

	}

	protected override onDefineParameters() {

	}

}
