# Temporal Typescript Workshop

This project walks through starting a brand new Temporal Project and incrementally adding functionaliy. It includes 

* Workflows & Activiites
* Tests
* Signals & Queries 

For more detailed courses, project based tutorials and example applications, check out our [courses](https://learn.temporal.io/)

## Prerequisites

* [Temporal CLI](https://docs.temporal.io/cli#install)
* Node.js 18 or later. See [this](https://learn.temporal.io/getting_started/typescript/dev_environment/) for more details.

## Install Dependencies (if you clone this repository)

If you clone this git repository, be sure to install dependencies by running the following command. You can skip 

```bash
npm install
```
Once installed, you can skip to running the workflow and starting a workflow section. 

## Create a new Temporal Typescript Project

Create a new Temporal project by running the following command:

```bash
npx @temporalio/create@latest --sample empty
```
This will prompt you for a project name. Use workshop

You will also be asked if you want to initialize a git repository for the project. You can choose either option.

Note the commands that are shared after it runs, **but don't run them at this time**.

```bash
# run the worker
npm run start.watch
```
```bash
# start the workflow
npm run workflow
```

Notice the files that are generated:

* activites.ts - the activities
* client.ts    - code to start the workflow
* shared.ts    - code common to starting and the worker
* worker.ts    - code to start the worker
* workflows.ts - workflow code

## Change the task queue name

In the shared.ts file, change the name of the TASK_QUEUE_NAME to 'workshp-tq' and save the file.

## Add an Echo activity

For the first activity, let's add a function that simply returns what is is passed in.

To make this easier, copy this code into the activities.ts file:

```typescript
import { log, sleep } from '@temporalio/activity';

export const createActivities = () => ({
    async echo(input: string): Promise<string> {
        log.info('echo activity started', { input });
    
        await sleep(1000);
    
        return input;
    }
})
```

## Create a workflow

In the workflows.ts file, copy the code below:

```typescript
import { proxyActivities } from "@temporalio/workflow";
import { createActivities } from "./activities";

const { echo } = proxyActivities<ReturnType<typeof createActivities>>( {
    startToCloseTimeout: '5 seconds',
    retry: {
      initialInterval: '1s',
      backoffCoefficient: 2,
      maximumInterval: '30s',
    },
});

export async function WorkshopWorkflow(input: string): Promise<string> {
    const result = echo(input);
    return `Echo returned: ${result}`;
}
```

## Change the worker

In the worker.ts file, change line # 2 from

```typescript
import * as activities from './activities';
```

to

```typescript
import { createActivities } from './activities';
```

In the worker.ts file, change line # 21 from 

```typescript
    activities,
```

to

```typescript
    activities: createActivities(),
```

## Import the workflow in client.ts

Change the import in client.ts to reflect the name of your workflow. In this case change

```
import { YOUR_WORKFLOW } from './workflows';
```
to

```
import { WorkshopWorkflow } from './workflows';
```

Also change line # 22 (client.workflow.start) from:

```typescript
const handle = await client.workflow.start(YOUR_WORKFLOW, {
```

to

```typescript
 const handle = await client.workflow.start(WorkshopWorkflow, {
```

## Run the workflow

For this part of the workshop, we'll need three different terminal windows.

In the first window start the temporal development server:

```bash
temporal server start-dev
```

Now start the worker
```bash
npm run start.watch
```

And finally, start the client:

```bash
npm run workflow
```

Alternatively, you can use the Temporal CLI to start the workflow:

```bash
temporal workflow start --type WorkshopWorkflow --task-queue workshop-tq --input '"Hello"'
```

## Testing

```bash
npm install @temporalio/testing
```

Inside the src/mocha folder, create a new file and call it workflow.test.ts.

Copy the code below:

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { proxyActivities, log, sleep } from '@temporalio/workflow';

import { after, before, it } from 'mocha';
import assert from 'assert';

import { approveSignal, WorkshopWorkflow } from '../workflows';
import { createActivities } from '../activities';

const testingTaskQueue = 'WorkshopTestTaskQueue';

describe('Testing Happy Path', () => {
    let testEnv: TestWorkflowEnvironment;

    before(async () => {
        testEnv = await TestWorkflowEnvironment.createTimeSkipping();
        // testEnv = await TestWorkflowEnvironment.createLocal();      
    });

    after(async () => {
        await testEnv?.teardown();
    });

    it('successfully completes the Workflow', async () => {
        const { client, nativeConnection } = testEnv;

        const worker = await Worker.create({
            connection: nativeConnection,
            taskQueue: testingTaskQueue,
            workflowsPath: require.resolve('../workflows'),
            activities: createActivities(),
        });

        const handle = await client.workflow.start(WorkshopWorkflow, {
            taskQueue: testingTaskQueue,
            args: ['Testing'],
            workflowId: 'test',
        });

        // signal the workflow
        // handle.signal(approveSignal, null);

        const result = await worker.runUntil(
            handle.result()
        );

        assert.equal(result, 'Echo returned: Testing');
    });
});
```

Save the file. You can run the test using the following command:

```bash
npm test
```

## Adding Signal and Query to the workflow

In the workflows.ts, change the WorkshopWorkflow function to look like this:

```typescript
    let approved = false;
    let approvalTime = 30; 
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
        // throw ApplicationFailure.create({message : `Approval not received within ${approvalTime} seconds`, type: 'timeout'});
    }

    currentStep = 'Complete!'

    return `Echo returned: ${result}`;
```

Run the test again and notice that the test is now broken:

```bash
npm test
```

Update the test and uncomment out line # 42. It looks like this:

```typescript
// handle.signal(approveSignal, null);
```

and should be 

```typescript
handle.signal(approveSignal, null);
```

Rerun the test:

```bash
npm test
```

And see that the test now passes! 

### Run the workflow & interact with it.

Let's run this workflow and interact with it. But before we do this, let's update the client code to send a signal and perform a query. 
Modify client.ts to look like this:

```typescript
import { Connection, Client } from '@temporalio/client';
import { nanoid } from 'nanoid';
import { TASK_QUEUE_NAME } from './shared';

// import your workflow
import { approveSignal, workflowStatusQuery, WorkshopWorkflow } from './workflows';

async function run() {
  // Connect to the default Server location
  const connection = await Connection.connect({ address: 'localhost:7233' });
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
  });

  // **** this section has changed ***
  const handle = await client.workflow.start(WorkshopWorkflow, {
    taskQueue: TASK_QUEUE_NAME,
    // type inference works! args: [name: string]
    args: ['Temporal'],
    // in practice, use a meaningful business ID, like customerId or transactionId
    workflowId: 'workflow-' + nanoid(),
  });
  console.log(`Started workflow ${handle.workflowId}`);

  // query this workflow
  var queryResponse = await handle.query(workflowStatusQuery);

  console.log(`The response from the query is ${queryResponse}`);

  // approve this workflow
  handle.signal(approveSignal, null);

  // optional: wait for client result
  console.log(await handle.result());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

```

First, if the Temporal Server is not running, be sure to start it:

```bash
temporal server start-dev
```

Now start the worker
```bash
npm run start.watch
```

And finally, run the client, which will start the workflow, query the status and then signal the workflow:
```bash
npm run workflow
```
## Add a test for a timeout for the signal

Now let's update the code in workflow.ts to throw an ApplicationFailure when a timeout occurs. 
Modify workflows.ts and change line # 57 which looks like this:

```typescript
// throw ApplicationFailure.create({message : `Approval not received within ${approvalTime} seconds`, type: 'timeout'});
```

to this:

```typescript
throw ApplicationFailure.create({message : `Approval not received within ${approvalTime} seconds`, type: 'timeout'});
```

In order to test this scenario, we need to add another test. In the workflow.test.cs add this to the end of the file and save it:

```typescript
describe('Testing Workflow Not Approved', () => {
  let testEnv: TestWorkflowEnvironment;

  before(async () => {
      testEnv = await TestWorkflowEnvironment.createTimeSkipping();  
      // testEnv = await TestWorkflowEnvironment.createLocal();      
    });

    after(async () => {
      await testEnv?.teardown();
    });

    it('successfully completes the Workflow', async () => {
      const { client, nativeConnection } = testEnv;
  
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: testingTaskQueue,
        workflowsPath: require.resolve('../workflows'),
        activities: createActivities(),
      });

      const handle = await client.workflow.start(WorkshopWorkflow, {
        taskQueue: testingTaskQueue,
        args: ['Testing'],
        workflowId: 'test',
      });

      try {
        const result = await worker.runUntil(
          handle.result()
        );
        assert.fail('Expecting an exception. Does the workflow throw an Error?')
      } 
      catch(e) {
        // expected
        console.log(`Exception caught. ${e}`);
      }
      
    });
});
```

Run the test again, and validate that the tests pass.

```bash
npm test
```

