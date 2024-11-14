import {
    log, 
    proxyActivities, 
    setHandler, 
    defineSignal, 
    condition,
    ApplicationFailure,
    defineQuery } from "@temporalio/workflow";
import { createActivities } from "./activities";

const { echo } = proxyActivities<ReturnType<typeof createActivities>>( {
    startToCloseTimeout: '5 seconds',
    retry: {
      initialInterval: '1s',
      backoffCoefficient: 2,
      maximumInterval: '30s',
    },
});

export const approveSignal = defineSignal<[null]>('approveSignal');
export const workflowStatusQuery = defineQuery<string>('workflowStatus');

export async function WorkshopWorkflow(input: string): Promise<string> {

    let approved = false;
    const approvalTime = 30;
    let currentStep = "Initializing";

    // Set Signal Handler
    setHandler(approveSignal, () => {
        log.info(`Approve Signal Received`);
        approved = true;
    });

    // Set Query Handler
    setHandler(workflowStatusQuery, () => {
        return currentStep;
    });

    const result = await echo(input);

    currentStep = 'Awaiting approval'

    // wait for this to be approved
    if (await condition(() => approved, `${approvalTime}s`)) {
        // approval has come in!
        currentStep = 'The workflow has been approved!';
    }
    else {
        // the timeout fired!
        log.info('The approval did not arrive on time!');
        currentStep = 'The workflow timed out while waiting to be approved';
        // don't throw the application yet as it will break the test
        throw ApplicationFailure.create({message : `Approval not received within ${approvalTime} seconds`, type: 'timeout'});
    }

    currentStep = 'Complete!'

    return `Echo returned: ${result}`;
}